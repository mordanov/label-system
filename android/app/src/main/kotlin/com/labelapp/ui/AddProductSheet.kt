package com.labelapp.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddProductSheet(vm: AppViewModel, onDone: () -> Unit) {
    val ctx = LocalContext.current

    val icons = remember {
        ctx.assets.list("icons")?.sorted() ?: emptyList()
    }

    var name by remember { mutableStateOf("") }
    var selectedIcon by remember { mutableStateOf(icons.firstOrNull() ?: "") }

    ModalBottomSheet(onDismissRequest = onDone) {
        Column(Modifier.padding(16.dp)) {
            Text("Новая позиция", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(12.dp))

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Название") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Spacer(Modifier.height(12.dp))

            Text("Иконка", style = MaterialTheme.typography.labelMedium)
            Spacer(Modifier.height(4.dp))

            LazyVerticalGrid(
                columns = GridCells.Adaptive(64.dp),
                modifier = Modifier.heightIn(max = 300.dp),
                contentPadding = PaddingValues(4.dp),
            ) {
                items(icons) { filename ->
                    val bitmap = remember(filename) {
                        runCatching {
                            val bytes = ctx.assets.open("icons/$filename").readBytes()
                            BitmapFactory.decodeByteArray(bytes, 0, bytes.size).asImageBitmap()
                        }.getOrNull()
                    }
                    Box(
                        Modifier
                            .padding(4.dp)
                            .size(56.dp)
                            .border(
                                2.dp,
                                if (filename == selectedIcon) MaterialTheme.colorScheme.primary else Color.Transparent,
                            )
                            .clickable { selectedIcon = filename },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (bitmap != null) Image(bitmap, contentDescription = filename, modifier = Modifier.size(48.dp))
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDone) { Text("Отмена") }
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = {
                        if (name.isNotBlank() && selectedIcon.isNotEmpty()) {
                            vm.addAndPrint(name.trim(), selectedIcon)
                            onDone()
                        }
                    },
                    enabled = name.isNotBlank() && selectedIcon.isNotEmpty(),
                ) { Text("Создать и печатать") }
            }
        }
    }
}
