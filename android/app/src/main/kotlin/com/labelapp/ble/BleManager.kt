package com.labelapp.ble

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Context
import com.labelapp.label.LabelRenderer
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import java.util.UUID

private val CONTROL_UUID = UUID.fromString("0000ae01-0000-1000-8000-00805f9b34fb")
private val NOTIFY_UUID  = UUID.fromString("0000ae02-0000-1000-8000-00805f9b34fb")
private val DATA_UUID    = UUID.fromString("0000ae03-0000-1000-8000-00805f9b34fb")
private val CCCD_UUID    = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

data class ScannedDevice(val address: String, val name: String)

// ponytail: one active connection at a time; fine for sequential printing
@SuppressLint("MissingPermission")
object BleManager {

    suspend fun scan(context: Context, timeoutMs: Long = 10_000): List<ScannedDevice> {
        val found = mutableMapOf<String, ScannedDevice>()
        val adapter = context.bluetoothAdapter
        val scanner = adapter.bluetoothLeScanner ?: error("BLE scanner unavailable")
        val cb = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val name = result.device.name ?: return
                found[result.device.address] = ScannedDevice(result.device.address, name)
            }
        }
        scanner.startScan(cb)
        delay(timeoutMs)
        scanner.stopScan(cb)
        return found.values.toList()
    }

    suspend fun print(context: Context, address: String, imageData: ByteArray) {
        val device = context.bluetoothAdapter.getRemoteDevice(address)
        val notifications = Channel<Pair<Int, ByteArray>>(Channel.UNLIMITED)
        val connectedDef  = CompletableDeferred<Unit>()
        val servicesDef   = CompletableDeferred<Unit>()
        val descriptorDef = CompletableDeferred<Unit>()

        val writeDone = Channel<Unit>(Channel.UNLIMITED)

        val cb = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    gatt.discoverServices()
                    connectedDef.complete(Unit)
                } else {
                    val ex = Exception("BLE connection lost (state=$newState status=$status)")
                    connectedDef.completeExceptionally(ex)
                }
            }

            override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                if (status == BluetoothGatt.GATT_SUCCESS) servicesDef.complete(Unit)
                else servicesDef.completeExceptionally(Exception("discoverServices failed"))
            }

            override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
                descriptorDef.complete(Unit)
            }

            override fun onCharacteristicWrite(gatt: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
                writeDone.trySend(Unit)
            }

            override fun onCharacteristicChanged(gatt: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray) {
                if (c.uuid == NOTIFY_UUID) parseNotification(value)?.let { notifications.trySend(it) }
            }

            @Suppress("OVERRIDE_DEPRECATION")
            override fun onCharacteristicChanged(gatt: BluetoothGatt, c: BluetoothGattCharacteristic) {
                onCharacteristicChanged(gatt, c, c.value ?: return)
            }
        }

        val gatt = device.connectGatt(context, false, cb, BluetoothDevice.TRANSPORT_LE)
        try {
            withTimeout(15_000) { connectedDef.await() }
            withTimeout(10_000) { servicesDef.await() }

            val controlChar = gatt.findChar(CONTROL_UUID) ?: error("Control char not found")
            val dataChar    = gatt.findChar(DATA_UUID)    ?: error("Data char not found")
            val notifyChar  = gatt.findChar(NOTIFY_UUID)  ?: error("Notify char not found")

            gatt.setCharacteristicNotification(notifyChar, true)
            val cccd = notifyChar.getDescriptor(CCCD_UUID) ?: error("CCCD not found")
            @Suppress("DEPRECATION")
            cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            @Suppress("DEPRECATION")
            gatt.writeDescriptor(cccd)
            withTimeout(5_000) { descriptorDef.await() }

            suspend fun writeControl(cmdId: Int, data: ByteArray, useCrc: Boolean) {
                // drain stale acks before each control write
                while (writeDone.tryReceive().isSuccess) {}
                @Suppress("DEPRECATION")
                controlChar.value = pkt(cmdId, data, useCrc)
                controlChar.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                @Suppress("DEPRECATION")
                gatt.writeCharacteristic(controlChar)
                // wait for ack or fall back to fixed delay
                withTimeoutOrNull(100) { writeDone.receive() } ?: delay(10)
            }

            suspend fun waitFor(cmdId: Int, timeoutMs: Long): ByteArray = withTimeout(timeoutMs) {
                while (true) {
                    val (id, payload) = notifications.receive()
                    if (id == cmdId) return@withTimeout payload
                }
                @Suppress("UNREACHABLE_CODE")
                throw CancellationException()
            }

            // Handshake
            writeControl(0xB1, byteArrayOf(), useCrc = true)
            writeControl(0xA2, byteArrayOf(0x5D), useCrc = true)
            writeControl(0xA1, byteArrayOf(0x00), useCrc = true)
            val a1 = waitFor(0xA1, 7_000)
            if (a1.size <= 6 || a1[6] != 0.toByte()) error("Printer not ready (${a1.hex()})")

            // Print start
            writeControl(0xA2, byteArrayOf(0x5D), useCrc = true)
            val h = LabelRenderer.HEIGHT
            writeControl(0xA9, byteArrayOf((h and 0xFF).toByte(), (h shr 8).toByte(), 48, 0), useCrc = false)
            val a9 = waitFor(0xA9, 7_000)
            if (a9.isEmpty() || a9[0] != 0.toByte()) error("Print start rejected (${a9.hex()})")

            // Image data in 20-byte chunks — wait for each ack to prevent dropped writes
            @Suppress("DEPRECATION")
            dataChar.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
            var i = 0
            while (i < imageData.size) {
                while (writeDone.tryReceive().isSuccess) {} // drain stale
                @Suppress("DEPRECATION")
                dataChar.value = imageData.copyOfRange(i, minOf(i + 20, imageData.size))
                @Suppress("DEPRECATION")
                gatt.writeCharacteristic(dataChar)
                withTimeoutOrNull(30) { writeDone.receive() } ?: delay(3)
                i += 20
            }

            // Finalize
            writeControl(0xAD, byteArrayOf(0x00), useCrc = false)
            waitFor(0xAA, maxOf(30_000L, h.toLong() / 10L * 1000L))

        } finally {
            gatt.close()
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private val Context.bluetoothAdapter: BluetoothAdapter
        get() = (getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter

    private fun BluetoothGatt.findChar(uuid: UUID): BluetoothGattCharacteristic? =
        services.firstNotNullOfOrNull { it.getCharacteristic(uuid) }

    private fun crc8(data: ByteArray): Byte {
        var crc = 0
        for (b in data) {
            crc = crc xor (b.toInt() and 0xFF)
            repeat(8) { crc = if (crc and 0x80 != 0) ((crc shl 1) xor 0x07) and 0xFF else (crc shl 1) and 0xFF }
        }
        return crc.toByte()
    }

    private fun pkt(cmdId: Int, data: ByteArray, useCrc: Boolean): ByteArray {
        val len = data.size
        val header = byteArrayOf(0x22, 0x21, cmdId.toByte(), 0x00, (len and 0xFF).toByte(), ((len shr 8) and 0xFF).toByte())
        val tail = if (useCrc) byteArrayOf(crc8(data), 0xFF.toByte()) else byteArrayOf(0, 0)
        return header + data + tail
    }

    private fun parseNotification(data: ByteArray): Pair<Int, ByteArray>? {
        if (data.size < 8 || data[0] != 0x22.toByte() || data[1] != 0x21.toByte()) return null
        val cmdId = data[2].toInt() and 0xFF
        val len = (data[4].toInt() and 0xFF) or ((data[5].toInt() and 0xFF) shl 8)
        return cmdId to data.copyOfRange(6, minOf(6 + len, data.size))
    }

    private fun ByteArray.hex() = joinToString("") { "%02x".format(it) }
}
