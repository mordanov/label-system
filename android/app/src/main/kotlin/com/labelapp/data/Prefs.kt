package com.labelapp.data

import android.content.Context

class Prefs(context: Context) {
    private val prefs = context.getSharedPreferences("label_app", Context.MODE_PRIVATE)

    var bleAddress: String?
        get() = prefs.getString("ble_address", null)
        set(v) = prefs.edit().putString("ble_address", v).apply()

    var serverUrl: String
        get() = prefs.getString("server_url", "https://labels.miveralta.ru") ?: "https://labels.miveralta.ru"
        set(v) = prefs.edit().putString("server_url", v).apply()

    var syncUsername: String
        get() = prefs.getString("sync_user", "") ?: ""
        set(v) = prefs.edit().putString("sync_user", v).apply()

    var syncPassword: String
        get() = prefs.getString("sync_pass", "") ?: ""
        set(v) = prefs.edit().putString("sync_pass", v).apply()
}
