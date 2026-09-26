package com.labelapp.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.widthIn

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductListScreen(vm: AppViewModel, onSettings: () -> Unit, onAdd: () -> Unit) {
    val products by vm.products.collectAsState()
    val query by vm.query.collectAsState()
    val printState by vm.printState.collectAsState()
    val loadError by vm.loadError.collectAsState()
    val updateAvailable by vm.updateAvailable.collectAsState()
    val downloading by vm.downloading.collectAsState()
    val iconCache by vm.iconCache.collectAsState()

    LaunchedEffect(printState) {
        if (printState is PrintState.Done) {
            kotlinx.coroutines.delay(2000)
            vm.clearPrintState()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Этикетки") },
                actions = {
                    IconButton(onClick = { vm.loadProducts() }) {
                        Text("↻", style = MaterialTheme.typography.titleLarge)
                    }
                    IconButton(onClick = onSettings) {
                        Text("⚙", style = MaterialTheme.typography.titleLarge)
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onAdd) {
                Text("+", style = MaterialTheme.typography.titleLarge)
            }
        }
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
          Column(Modifier.widthIn(max = 720.dp).fillMaxSize()) {
            if (updateAvailable) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Доступна новая версия", modifier = Modifier.weight(1f))
                    Button(
                        onClick = { vm.downloadAndInstall() },
                        enabled = !downloading,
                    ) { Text(if (downloading) "Загрузка…" else "Обновить") }
                }
            }

            if (loadError != null) {
                Row(
                    Modifier.fillMaxWidth().padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Ошибка: $loadError",
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    TextButton(onClick = { vm.loadProducts() }) { Text("Повторить") }
                }
            }

            TextField(
                value = query,
                onValueChange = vm::setQuery,
                placeholder = { Text("Поиск…") },
                modifier = Modifier.fillMaxWidth().padding(8.dp),
                singleLine = true,
                trailingIcon = {
                    if (query.isNotEmpty()) {
                        TextButton(onClick = { vm.setQuery("") }) { Text("×") }
                    }
                },
            )

            LazyColumn(Modifier.weight(1f)) {
                items(products, key = { it.id }) { product ->
                    ProductRow(
                        product = product,
                        onReprint = { vm.reprint(it) },
                        onDelete = vm::softDelete,
                        onRestore = vm::restoreProduct,
                        iconCache = iconCache,
                        onLoadIcon = vm::loadIcon,
                    )
                    HorizontalDivider()
                }
            }
          } // inner max-width column
        }

        // Print status overlay
        when (val s = printState) {
            PrintState.Printing -> AlertDialog(
                onDismissRequest = {},
                confirmButton = {},
                title = { Text("Печать…") },
                text = { CircularProgressIndicator() },
            )
            PrintState.Done -> AlertDialog(
                onDismissRequest = { vm.clearPrintState() },
                confirmButton = { TextButton(onClick = { vm.clearPrintState() }) { Text("OK") } },
                title = { Text("Напечатано") },
            )
            is PrintState.Error -> AlertDialog(
                onDismissRequest = { vm.clearPrintState() },
                confirmButton = { TextButton(onClick = { vm.clearPrintState() }) { Text("OK") } },
                title = { Text("Ошибка") },
                text = { Text(s.msg) },
            )
            else -> {}
        }
    }
}

@Composable
private fun ProductRow(
    product: com.labelapp.data.Product,
    onReprint: (com.labelapp.data.Product) -> Unit,
    onDelete: (String) -> Unit,
    onRestore: (String) -> Unit,
    iconCache: Map<String, Bitmap?>,
    onLoadIcon: (String) -> Unit,
) {
    LaunchedEffect(product.iconFilename) { onLoadIcon(product.iconFilename) }

    val bitmap = iconCache[product.iconFilename]?.asImageBitmap()
    var confirmDelete by remember { mutableStateOf(false) }
    var confirmRestore by remember { mutableStateOf(false) }
    val rowAlpha = if (product.isDeleted) 0.5f else 1f

    Row(
        Modifier.fillMaxWidth().alpha(rowAlpha).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (bitmap != null) {
            Image(bitmap, contentDescription = null, modifier = Modifier.size(40.dp))
        } else {
            Box(Modifier.size(40.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                product.name,
                style = MaterialTheme.typography.bodyLarge,
                textDecoration = if (product.isDeleted) TextDecoration.LineThrough else TextDecoration.None,
            )
            Text("#${product.inventoryNumber}  ${product.createdAt}", style = MaterialTheme.typography.bodySmall)
        }
        if (product.isDeleted) {
            TextButton(onClick = { confirmRestore = true }) { Text("Восст.") }
        } else {
            TextButton(onClick = { onReprint(product) }) { Text("Печать") }
            TextButton(onClick = { confirmDelete = true }) { Text("×") }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            confirmButton = { TextButton(onClick = { onDelete(product.id); confirmDelete = false }) { Text("Удалить") } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Отмена") } },
            title = { Text("Удалить «${product.name}»?") },
        )
    }

    if (confirmRestore) {
        AlertDialog(
            onDismissRequest = { confirmRestore = false },
            confirmButton = { TextButton(onClick = { onRestore(product.id); confirmRestore = false }) { Text("Восстановить") } },
            dismissButton = { TextButton(onClick = { confirmRestore = false }) { Text("Отмена") } },
            title = { Text("Восстановить «${product.name}»?") },
        )
    }
}
