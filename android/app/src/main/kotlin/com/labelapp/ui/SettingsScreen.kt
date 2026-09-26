package com.labelapp.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: AppViewModel, onBack: () -> Unit) {
    val scanned by vm.scannedDevices.collectAsState()
    val tokenState by vm.tokenState.collectAsState()
    val showDeleted by vm.showDeleted.collectAsState()
    var address by remember { mutableStateOf(vm.prefs.bleAddress ?: "") }
    var scanning by remember { mutableStateOf(false) }
    var serverUrl by remember { mutableStateOf(vm.prefs.serverUrl) }
    var syncUser by remember { mutableStateOf(vm.prefs.syncUsername) }
    var syncPass by remember { mutableStateOf(vm.prefs.syncPassword) }
    val hasToken = vm.prefs.authToken != null

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Настройки") },
                navigationIcon = { TextButton(onClick = onBack) { Text("←") } },
            )
        }
    ) { padding ->
        Column(Modifier.padding(padding).padding(16.dp).verticalScroll(rememberScrollState())) {
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
                scanned.forEach { device ->
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
                if (scanned.isEmpty()) Text("Сканирование…", Modifier.padding(top = 8.dp))
            }

            Spacer(Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))
            Text("Подключение к серверу", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = serverUrl,
                onValueChange = { serverUrl = it; vm.prefs.serverUrl = it },
                label = { Text("URL сервера") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = syncUser,
                onValueChange = { syncUser = it; vm.prefs.syncUsername = it },
                label = { Text("Логин") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = syncPass,
                onValueChange = { syncPass = it; vm.prefs.syncPassword = it },
                label = { Text("Пароль") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            )
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { vm.refreshToken() },
                enabled = tokenState == null && syncUser.isNotBlank() && syncPass.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (tokenState == null) "Подключить к серверу" else "Подключение…")
            }
            when {
                tokenState == "OK" -> Text(
                    "✓ Подключено${if (hasToken) " (токен сохранён)" else ""}",
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.bodySmall,
                )
                tokenState != null && tokenState != "OK" -> Text(
                    tokenState!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
                hasToken -> Text(
                    "Токен активен (действует 90 дней)",
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            Spacer(Modifier.height(24.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))
            Text("Отображение", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Просмотр удалённых позиций")
                Switch(checked = showDeleted, onCheckedChange = { vm.setShowDeleted(it) })
            }
        }
    }
}
