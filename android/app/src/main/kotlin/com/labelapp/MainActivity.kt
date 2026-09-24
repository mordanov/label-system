package com.labelapp

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import com.labelapp.ui.*

class MainActivity : ComponentActivity() {

    private val vm: AppViewModel by viewModels()

    private val requestPermissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        requestPermissions.launch(permissions)

        setContent {
            MaterialTheme {
                App(vm)
            }
        }
    }
}

@Composable
private fun App(vm: AppViewModel) {
    var screen by remember { mutableStateOf("list") }
    var showAdd by remember { mutableStateOf(false) }

    when (screen) {
        "list" -> ProductListScreen(
            vm = vm,
            onSettings = { screen = "settings" },
            onAdd = { showAdd = true },
        )
        "settings" -> SettingsScreen(vm = vm, onBack = { screen = "list" })
    }

    if (showAdd) {
        AddProductSheet(vm = vm, onDone = { showAdd = false })
    }
}
