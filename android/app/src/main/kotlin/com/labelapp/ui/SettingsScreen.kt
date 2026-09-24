package com.labelapp.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: AppViewModel, onBack: () -> Unit) {
    val scanned by vm.scannedDevices.collectAsState()
    var address by remember { mutableStateOf(vm.prefs.bleAddress ?: "") }
    var scanning by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Настройки") },
                navigationIcon = { TextButton(onClick = onBack) { Text("←") } },
            )
        }
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp)) {
            Text("Адрес BLE-принтера", style = MaterialTheme.typography.labelLarge)
            Spacer(Modifier.height(4.dp))
            OutlinedTextField(
                value = address,
                onValueChange = { address = it },
                label = { Text("MAC или имя устройства") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Spacer(Modifier.height(8.dp))
            Row {
                Button(onClick = {
                    vm.prefs.bleAddress = address.trim().takeIf { it.isNotEmpty() }
                    onBack()
                }) { Text("Сохранить") }
                Spacer(Modifier.width(8.dp))
                OutlinedButton(onClick = {
                    scanning = true
                    vm.scanDevices()
                }) { Text("Сканировать BLE (10 с)") }
            }

            if (scanning) {
                Spacer(Modifier.height(16.dp))
                Text("Найденные устройства:", style = MaterialTheme.typography.labelLarge)
                LazyColumn {
                    if (scanned.isEmpty()) {
                        item { Text("Сканирование…", Modifier.padding(top = 8.dp)) }
                    }
                    items(scanned) { device ->
                        ListItem(
                            headlineContent = { Text(device.name) },
                            supportingContent = { Text(device.address) },
                            modifier = Modifier.clickable {
                                address = device.address
                                vm.prefs.bleAddress = device.address
                                scanning = false
                            },
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}
