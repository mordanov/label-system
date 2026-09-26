package com.labelapp.ui

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
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddProductSheet(vm: AppViewModel, onDone: () -> Unit) {
    val iconList by vm.iconList.collectAsState()
    val iconCache by vm.iconCache.collectAsState()
    val generatingIcon by vm.generatingIcon.collectAsState()
    val generatedFilename by vm.generatedIconFilename.collectAsState()

    LaunchedEffect(Unit) { vm.loadIconList() }

    var name by remember { mutableStateOf("") }
    var selectedIcon by remember { mutableStateOf("") }
    var copies by remember { mutableStateOf(1) }

    // Auto-select generated icon when it arrives
    LaunchedEffect(generatedFilename) {
        if (generatedFilename != null) selectedIcon = generatedFilename!!
    }

    // Pre-select first icon when list loads
    LaunchedEffect(iconList) {
        if (selectedIcon.isEmpty() && iconList.isNotEmpty()) selectedIcon = iconList.first()
    }

    ModalBottomSheet(onDismissRequest = {
        vm.clearGeneratedIcon()
        onDone()
    }) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {

            Text("Новая позиция", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(12.dp))

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Название") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Spacer(Modifier.height(8.dp))

            // Copies counter
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Кол-во:", Modifier.weight(1f))
                TextButton(onClick = { if (copies > 1) copies-- }) { Text("−") }
                Text("$copies", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(horizontal = 8.dp))
                TextButton(onClick = { if (copies < 10) copies++ }) { Text("+") }
            }
            Spacer(Modifier.height(8.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = { vm.clearGeneratedIcon(); onDone() }) { Text("Отмена") }
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = {
                        if (name.isNotBlank() && selectedIcon.isNotEmpty()) {
                            vm.addAndPrint(name.trim(), selectedIcon, copies)
                            vm.clearGeneratedIcon()
                            onDone()
                        }
                    },
                    enabled = name.isNotBlank() && selectedIcon.isNotEmpty(),
                ) { Text("Создать и печатать") }
            }

            HorizontalDivider(Modifier.padding(vertical = 8.dp))

            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Иконка", style = MaterialTheme.typography.labelMedium)
                OutlinedButton(
                    onClick = { if (name.isNotBlank()) vm.generateIcon(name) },
                    enabled = name.isNotBlank() && !generatingIcon,
                ) {
                    if (generatingIcon) {
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(6.dp))
                    }
                    Text(if (generatingIcon) "Генерация…" else "Генерировать")
                }
            }
            Spacer(Modifier.height(4.dp))

            LazyVerticalGrid(
                columns = GridCells.Adaptive(64.dp),
                modifier = Modifier.fillMaxWidth().height(320.dp),
                contentPadding = PaddingValues(bottom = 16.dp),
            ) {
                items(iconList) { filename ->
                    LaunchedEffect(filename) { vm.loadIcon(filename) }
                    val bitmap = iconCache[filename]?.asImageBitmap()
                    Box(
                        Modifier
                            .padding(4.dp)
                            .size(56.dp)
                            .border(2.dp, if (filename == selectedIcon) MaterialTheme.colorScheme.primary else Color.Transparent)
                            .clickable { selectedIcon = filename },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (bitmap != null) Image(bitmap, contentDescription = filename, modifier = Modifier.size(48.dp))
                        else Box(Modifier.size(48.dp))
                    }
                }
            }
        }
    }
}
