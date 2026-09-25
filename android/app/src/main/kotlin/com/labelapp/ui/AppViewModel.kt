package com.labelapp.ui

import android.app.Application
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.labelapp.ble.BleManager
import com.labelapp.ble.ScannedDevice
import com.labelapp.data.Prefs
import com.labelapp.data.Product
import com.labelapp.label.LabelRenderer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

sealed class PrintState {
    object Idle : PrintState()
    object Printing : PrintState()
    object Done : PrintState()
    data class Error(val msg: String) : PrintState()
}

class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val ctx = app
    val prefs = Prefs(app)

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query

    private val _allProducts = MutableStateFlow<List<Product>>(emptyList())

    val products: StateFlow<List<Product>> = combine(_allProducts, _query) { all, q ->
        if (q.isBlank()) all else all.filter { it.name.contains(q, ignoreCase = true) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _printState = MutableStateFlow<PrintState>(PrintState.Idle)
    val printState: StateFlow<PrintState> = _printState

    private val _loadError = MutableStateFlow<String?>(null)
    val loadError: StateFlow<String?> = _loadError

    private val _scannedDevices = MutableStateFlow<List<ScannedDevice>>(emptyList())
    val scannedDevices: StateFlow<List<ScannedDevice>> = _scannedDevices

    init { loadProducts() }

    fun setQuery(q: String) { _query.value = q }

    fun loadProducts() = viewModelScope.launch(Dispatchers.IO) {
        _loadError.value = null
        try {
            _allProducts.value = fetchFromServer()
        } catch (e: Exception) {
            _loadError.value = e.message ?: "Ошибка загрузки"
        }
    }

    fun addAndPrint(name: String, iconFilename: String) = viewModelScope.launch(Dispatchers.IO) {
        _printState.value = PrintState.Printing
        try {
            val body = JSONObject().apply {
                put("name", name)
                put("icon_filename", iconFilename)
            }.toString()
            val conn = openApi("/api/products", "POST", body)
            if (conn.responseCode != 200) error("HTTP ${conn.responseCode}")
            val product = parseProduct(JSONObject(conn.inputStream.bufferedReader().readText()))
            _allProducts.value = listOf(product) + _allProducts.value
            doPrint(product)
        } catch (e: Exception) {
            _printState.value = PrintState.Error(e.message ?: "Ошибка создания")
        }
    }

    fun reprint(product: Product) = viewModelScope.launch { doPrint(product) }

    fun softDelete(id: String) = viewModelScope.launch(Dispatchers.IO) {
        try {
            val conn = openApi("/api/products/$id/delete", "POST")
            if (conn.responseCode == 200) {
                _allProducts.value = _allProducts.value.filter { it.id != id }
            }
        } catch (_: Exception) {}
    }

    fun scanDevices() = viewModelScope.launch {
        _scannedDevices.value = emptyList()
        _scannedDevices.value = BleManager.scan(ctx)
    }

    fun clearPrintState() { _printState.value = PrintState.Idle }
    fun clearLoadError() { _loadError.value = null }

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

    private fun openApi(path: String, method: String, body: String? = null): HttpURLConnection {
        val conn = URL("${prefs.serverUrl.trimEnd('/')}$path").openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.setRequestProperty(
            "Authorization",
            "Basic ${Base64.encodeToString("${prefs.syncUsername}:${prefs.syncPassword}".toByteArray(), Base64.NO_WRAP)}"
        )
        conn.connectTimeout = 15_000
        conn.readTimeout = 15_000
        if (body != null) {
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.write(body.toByteArray())
        }
        return conn
    }

    private fun fetchFromServer(): List<Product> {
        val conn = openApi("/api/products", "GET")
        if (conn.responseCode != 200) error("HTTP ${conn.responseCode}")
        val arr = JSONArray(conn.inputStream.bufferedReader().readText())
        return (0 until arr.length()).map { parseProduct(arr.getJSONObject(it)) }
    }

    private fun parseProduct(obj: JSONObject) = Product(
        id = obj.getString("id"),
        inventoryNumber = obj.getString("inventory_number"),
        name = obj.getString("name"),
        iconFilename = obj.optString("icon_filename", "placeholder.png"),
        createdAt = obj.getString("created_at").take(10),
    )
}
