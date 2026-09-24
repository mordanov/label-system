package com.labelapp.ui

import android.app.Application
import android.graphics.BitmapFactory
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.labelapp.ble.BleManager
import com.labelapp.ble.ScannedDevice
import com.labelapp.data.AppDatabase
import com.labelapp.data.InventoryCounter
import com.labelapp.data.Prefs
import com.labelapp.data.Product
import com.labelapp.label.LabelRenderer
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate

sealed class PrintState {
    object Idle : PrintState()
    object Printing : PrintState()
    object Done : PrintState()
    data class Error(val msg: String) : PrintState()
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
