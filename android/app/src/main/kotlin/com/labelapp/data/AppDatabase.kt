package com.labelapp.data

data class Product(
    val id: String,
    val inventoryNumber: String,
    val name: String,
    val iconFilename: String,
    val createdAt: String,
    val isDeleted: Boolean = false,
    val deletedAt: String? = null,
    val deletedBy: String? = null,
)
