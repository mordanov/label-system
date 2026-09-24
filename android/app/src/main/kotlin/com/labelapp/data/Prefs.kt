package com.labelapp.data

import android.content.Context

class Prefs(context: Context) {
    private val prefs = context.getSharedPreferences("label_app", Context.MODE_PRIVATE)

    var bleAddress: String?
        get() = prefs.getString("ble_address", null)
        set(v) = prefs.edit().putString("ble_address", v).apply()
}
