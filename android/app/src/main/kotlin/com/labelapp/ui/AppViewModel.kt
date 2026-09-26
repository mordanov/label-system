package com.labelapp.ui

import android.app.Application
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.core.content.FileProvider
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.labelapp.BuildConfig
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
import java.io.File
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

    private val _showDeleted = MutableStateFlow(prefs.showDeleted)
    val showDeleted: StateFlow<Boolean> = _showDeleted

    private val _allProducts = MutableStateFlow<List<Product>>(emptyList())

    val products: StateFlow<List<Product>> = combine(_allProducts, _query, _showDeleted) { all, q, showDel ->
        val filtered = if (showDel) all else all.filter { !it.isDeleted }
        if (q.isBlank()) filtered
        else filtered.filter {
            it.name.contains(q, ignoreCase = true) || it.inventoryNumber.contains(q, ignoreCase = true)
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _printState = MutableStateFlow<PrintState>(PrintState.Idle)
    val printState: StateFlow<PrintState> = _printState

    private val _loadError = MutableStateFlow<String?>(null)
    val loadError: StateFlow<String?> = _loadError

    private val _scannedDevices = MutableStateFlow<List<ScannedDevice>>(emptyList())
    val scannedDevices: StateFlow<List<ScannedDevice>> = _scannedDevices

    private val _updateAvailable = MutableStateFlow(false)
    val updateAvailable: StateFlow<Boolean> = _updateAvailable

    private val _downloading = MutableStateFlow(false)
    val downloading: StateFlow<Boolean> = _downloading

    private val _iconCache = MutableStateFlow<Map<String, Bitmap?>>(emptyMap())
    val iconCache: StateFlow<Map<String, Bitmap?>> = _iconCache
    private val _iconRequested = mutableSetOf<String>()

    private val _iconList = MutableStateFlow<List<String>>(emptyList())
    val iconList: StateFlow<List<String>> = _iconList

    private val _generatingIcon = MutableStateFlow(false)
    val generatingIcon: StateFlow<Boolean> = _generatingIcon

    private val _generatedIconFilename = MutableStateFlow<String?>(null)
    val generatedIconFilename: StateFlow<String?> = _generatedIconFilename

    init {
        loadProducts()
        checkForUpdate()
    }

    fun setQuery(q: String) { _query.value = q }

    fun setShowDeleted(v: Boolean) {
        prefs.showDeleted = v
        _showDeleted.value = v
        loadProducts()
    }

    fun loadProducts() = viewModelScope.launch(Dispatchers.IO) {
        _loadError.value = null
        try {
            _allProducts.value = fetchFromServer()
        } catch (e: Exception) {
            _loadError.value = e.message ?: "Ошибка загрузки"
        }
    }

    fun loadIcon(filename: String) = viewModelScope.launch(Dispatchers.IO) {
        if (filename.isBlank() || filename == "placeholder.png") return@launch
        val alreadyRequested = synchronized(_iconRequested) {
            if (_iconRequested.contains(filename)) true
            else { _iconRequested.add(filename); false }
        }
        if (alreadyRequested) return@launch
        try {
            val conn = openApi("/api/icons/$filename", "GET")
            if (conn.responseCode != 200) return@launch
            val bytes = conn.inputStream.readBytes()
            val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return@launch
            _iconCache.value = _iconCache.value + (filename to bmp)
        } catch (_: Exception) {}
    }

    fun loadIconList() = viewModelScope.launch(Dispatchers.IO) {
        try {
            val conn = openApi("/api/icons", "GET")
            if (conn.responseCode != 200) return@launch
            val arr = JSONArray(conn.inputStream.bufferedReader().readText())
            _iconList.value = (0 until arr.length()).map { arr.getJSONObject(it).getString("filename") }
        } catch (_: Exception) {}
    }

    fun generateIcon(name: String) = viewModelScope.launch(Dispatchers.IO) {
        _generatingIcon.value = true
        try {
            val body = JSONObject().put("dish_name", name).toString()
            val conn = openApi("/api/icons/generate", "POST", body)
            if (conn.responseCode != 200) return@launch
            val json = JSONObject(conn.inputStream.bufferedReader().readText())
            val filename = json.getString("filename")
            val b64 = json.getString("image_b64")
            val bytes = Base64.decode(b64, Base64.DEFAULT)
            val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            if (bmp != null) _iconCache.value = _iconCache.value + (filename to bmp)
            _generatedIconFilename.value = filename
        } catch (_: Exception) {
        } finally {
            _generatingIcon.value = false
        }
    }

    fun clearGeneratedIcon() { _generatedIconFilename.value = null }

    fun addAndPrint(name: String, iconFilename: String, copies: Int = 1) = viewModelScope.launch(Dispatchers.IO) {
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
            repeat(copies) { doPrint(product) }
        } catch (e: Exception) {
            _printState.value = PrintState.Error(e.message ?: "Ошибка создания")
        }
    }

    fun reprint(product: Product, copies: Int = 1) = viewModelScope.launch { repeat(copies) { doPrint(product) } }

    fun softDelete(id: String) = viewModelScope.launch(Dispatchers.IO) {
        try {
            val conn = openApi("/api/products/$id/delete", "POST")
            if (conn.responseCode == 200) {
                _allProducts.value = _allProducts.value.filter { it.id != id }
            }
        } catch (_: Exception) {}
    }

    fun restoreProduct(id: String) = viewModelScope.launch(Dispatchers.IO) {
        try {
            val conn = openApi("/api/products/$id/restore", "POST")
            if (conn.responseCode == 200) {
                val restored = parseProduct(JSONObject(conn.inputStream.bufferedReader().readText()))
                _allProducts.value = _allProducts.value.map { if (it.id == id) restored else it }
            }
        } catch (_: Exception) {}
    }

    fun scanDevices() = viewModelScope.launch {
        _scannedDevices.value = emptyList()
        _scannedDevices.value = BleManager.scan(ctx)
    }

    fun clearPrintState() { _printState.value = PrintState.Idle }
    fun clearLoadError() { _loadError.value = null }

    private fun checkForUpdate() = viewModelScope.launch(Dispatchers.IO) {
        try {
            val conn = openApi("/download/apk/info", "GET")
            if (conn.responseCode != 200) return@launch
            val serverCode = JSONObject(conn.inputStream.bufferedReader().readText()).optInt("version_code", 0)
            if (serverCode > BuildConfig.VERSION_CODE) _updateAvailable.value = true
        } catch (_: Exception) {}
    }

    fun downloadAndInstall() = viewModelScope.launch(Dispatchers.IO) {
        _downloading.value = true
        try {
            val conn = URL("${prefs.serverUrl.trimEnd('/')}/download/apk").openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization",
                "Basic ${Base64.encodeToString("${prefs.syncUsername}:${prefs.syncPassword}".toByteArray(), Base64.NO_WRAP)}")
            conn.connectTimeout = 15_000
            conn.readTimeout = 120_000
            if (conn.responseCode != 200) return@launch
            val apkFile = File(ctx.cacheDir, "updates/label-app.apk").also { it.parentFile?.mkdirs() }
            conn.inputStream.use { input -> apkFile.outputStream().use { input.copyTo(it) } }
            val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.provider", apkFile)
            ctx.startActivity(Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            })
            _updateAvailable.value = false
        } catch (_: Exception) {
        } finally {
            _downloading.value = false
        }
    }

    private suspend fun doPrint(product: Product) {
        val address = prefs.bleAddress ?: run {
            _printState.value = PrintState.Error("Нет адреса принтера. Настройте в параметрах.")
            return
        }
        _printState.value = PrintState.Printing
        val iconBitmap = _iconCache.value[product.iconFilename]
            ?: try {
                ctx.assets.open("icons/${product.iconFilename}").readBytes()
                    .let { BitmapFactory.decodeByteArray(it, 0, it.size) }
            } catch (_: Exception) { null }
        val imageData = LabelRenderer.renderToBytes(product, iconBitmap)
        try {
            BleManager.print(ctx, address, imageData)
            _printState.value = PrintState.Done
        } catch (e: Exception) {
            _printState.value = PrintState.Error(e.message ?: "Ошибка печати")
        }
    }

    // ponytail: tries token first, falls back to Basic so old installs keep working
    private fun openApi(path: String, method: String, body: String? = null): HttpURLConnection {
        val conn = URL("${prefs.serverUrl.trimEnd('/')}$path").openConnection() as HttpURLConnection
        conn.requestMethod = method
        val token = prefs.authToken
        if (token != null) {
            conn.setRequestProperty("Authorization", "Bearer $token")
        } else {
            conn.setRequestProperty("Authorization",
                "Basic ${Base64.encodeToString("${prefs.syncUsername}:${prefs.syncPassword}".toByteArray(), Base64.NO_WRAP)}")
        }
        conn.connectTimeout = 15_000
        conn.readTimeout = 15_000
        if (body != null) {
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.write(body.toByteArray())
        }
        return conn
    }

    private val _tokenState = MutableStateFlow<String?>(null)
    val tokenState: StateFlow<String?> = _tokenState

    fun refreshToken() = viewModelScope.launch(Dispatchers.IO) {
        _tokenState.value = null
        try {
            val body = JSONObject().apply {
                put("username", prefs.syncUsername)
                put("password", prefs.syncPassword)
            }.toString()
            val conn = URL("${prefs.serverUrl.trimEnd('/')}/auth/token").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 15_000
            conn.readTimeout = 15_000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.write(body.toByteArray())
            if (conn.responseCode != 200) {
                _tokenState.value = "Ошибка: HTTP ${conn.responseCode}"
                return@launch
            }
            val json = JSONObject(conn.inputStream.bufferedReader().readText())
            prefs.authToken = json.getString("token")
            _tokenState.value = "OK"
            loadProducts()
        } catch (e: Exception) {
            _tokenState.value = "Ошибка: ${e.message}"
        }
    }

    private fun fetchFromServer(): List<Product> {
        val path = if (prefs.showDeleted) "/api/products?include_deleted=true" else "/api/products"
        val conn = openApi(path, "GET")
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
        isDeleted = obj.optBoolean("is_deleted", false),
        deletedAt = obj.optString("deleted_at", "").takeIf { it.isNotEmpty() },
        deletedBy = obj.optString("deleted_by", "").takeIf { it.isNotEmpty() },
    )
}
