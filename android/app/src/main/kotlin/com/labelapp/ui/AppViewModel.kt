package com.labelapp.ui

import android.app.Application
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.labelapp.ble.BleManager
import com.labelapp.ble.ScannedDevice
import com.labelapp.data.AppDatabase
import com.labelapp.data.InventoryCounter
import com.labelapp.data.Prefs
import com.labelapp.data.Product
import com.labelapp.label.LabelRenderer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

sealed class PrintState {
    object Idle : PrintState()
    object Printing : PrintState()
    object Done : PrintState()
    data class Error(val msg: String) : PrintState()
}

sealed class SyncState {
    object Idle : SyncState()
    object Syncing : SyncState()
    data class Done(val imported: Int) : SyncState()
    data class Error(val msg: String) : SyncState()
}

class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val ctx = app
    private val dao = AppDatabase.get(app).productDao()
    val prefs = Prefs(app)

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query

    val products: StateFlow<List<Product>> = _query
        .flatMapLatest { q -> if (q.isBlank()) dao.observeAll() else dao.search(q) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _printState = MutableStateFlow<PrintState>(PrintState.Idle)
    val printState: StateFlow<PrintState> = _printState

    private val _scannedDevices = MutableStateFlow<List<ScannedDevice>>(emptyList())
    val scannedDevices: StateFlow<List<ScannedDevice>> = _scannedDevices

    fun setQuery(q: String) { _query.value = q }

    fun addAndPrint(name: String, iconFilename: String) = viewModelScope.launch {
        val invNum = nextInventoryNumber()
        val product = Product(
            inventoryNumber = invNum,
            name = name,
            iconFilename = iconFilename,
            createdAt = LocalDate.now().toString(),
        )
        dao.insert(product)
        doPrint(product)
    }

    fun reprint(product: Product) = viewModelScope.launch { doPrint(product) }

    fun softDelete(id: Int) = viewModelScope.launch { dao.softDelete(id) }

    fun scanDevices() = viewModelScope.launch {
        _scannedDevices.value = emptyList()
        _scannedDevices.value = BleManager.scan(ctx)
    }

    fun clearPrintState() { _printState.value = PrintState.Idle }

    private val _syncState = MutableStateFlow<SyncState>(SyncState.Idle)
    val syncState: StateFlow<SyncState> = _syncState

    fun syncFromServer() = viewModelScope.launch(Dispatchers.IO) {
        _syncState.value = SyncState.Syncing
        try {
            val conn = URL("${prefs.serverUrl.trimEnd('/')}/api/products").openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty(
                "Authorization",
                "Basic ${Base64.encodeToString("${prefs.syncUsername}:${prefs.syncPassword}".toByteArray(), Base64.NO_WRAP)}"
            )
            conn.connectTimeout = 15_000
            conn.readTimeout = 15_000
            if (conn.responseCode != 200) error("HTTP ${conn.responseCode}")
            val arr = JSONArray(conn.inputStream.bufferedReader().readText())
            var count = 0
            var maxNum = 0
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                if (obj.optBoolean("is_deleted", false)) continue
                val invNum = obj.getString("inventory_number")
                if (dao.findByInventoryNumber(invNum) != null) continue
                dao.insert(Product(
                    inventoryNumber = invNum,
                    name = obj.getString("name"),
                    iconFilename = obj.optString("icon_filename", "placeholder.png"),
                    createdAt = obj.getString("created_at").take(10),
                ))
                count++
                maxNum = maxOf(maxNum, invNum.toIntOrNull() ?: 0)
            }
            if (maxNum > 0) {
                val cur = dao.getCounter()?.lastNumber ?: 0
                if (maxNum > cur) dao.upsertCounter(InventoryCounter(lastNumber = maxNum))
            }
            _syncState.value = SyncState.Done(count)
        } catch (e: Exception) {
            _syncState.value = SyncState.Error(e.message ?: "Ошибка синхронизации")
        }
    }

    fun clearSyncState() { _syncState.value = SyncState.Idle }

    private suspend fun doPrint(product: Product) {
        val address = prefs.bleAddress ?: run {
            _printState.value = PrintState.Error("Нет адреса принтера. Настройте в параметрах.")
            return
        }
        _printState.value = PrintState.Printing
        val iconBytes = try { ctx.assets.open("icons/${product.iconFilename}").readBytes() } catch (_: Exception) { null }
        val iconBitmap = iconBytes?.let { BitmapFactory.decodeByteArray(it, 0, it.size) }
        val imageData = LabelRenderer.renderToBytes(product, iconBitmap)
        try {
            BleManager.print(ctx, address, imageData)
            _printState.value = PrintState.Done
        } catch (e: Exception) {
            _printState.value = PrintState.Error(e.message ?: "Ошибка печати")
        }
    }

    private suspend fun nextInventoryNumber(): String {
        val counter = dao.getCounter() ?: InventoryCounter()
        val next = (counter.lastNumber % 9999) + 1
        dao.upsertCounter(counter.copy(lastNumber = next))
        return "%04d".format(next)
    }
}
