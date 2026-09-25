package com.labelapp.data

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "products")
data class Product(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val inventoryNumber: String,
    val name: String,
    val iconFilename: String,
    val createdAt: String,
    val isDeleted: Boolean = false,
)

@Entity(tableName = "inventory_counter")
data class InventoryCounter(
    @PrimaryKey val id: Int = 1,
    val lastNumber: Int = 0,
)

@Dao
interface ProductDao {
    @Query("SELECT * FROM products WHERE isDeleted = 0 ORDER BY id DESC")
    fun observeAll(): Flow<List<Product>>

    @Query("SELECT * FROM products WHERE isDeleted = 0 AND name LIKE '%' || :q || '%' ORDER BY id DESC")
    fun search(q: String): Flow<List<Product>>

    @Insert
    suspend fun insert(product: Product): Long

    @Query("UPDATE products SET isDeleted = 1 WHERE id = :id")
    suspend fun softDelete(id: Int)

    @Query("SELECT * FROM inventory_counter WHERE id = 1")
    suspend fun getCounter(): InventoryCounter?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCounter(counter: InventoryCounter)

    @Query("SELECT * FROM products WHERE inventoryNumber = :num LIMIT 1")
    suspend fun findByInventoryNumber(num: String): Product?
}

@Database(
    entities = [Product::class, InventoryCounter::class],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun productDao(): ProductDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun get(context: Context): AppDatabase = INSTANCE ?: synchronized(this) {
            INSTANCE ?: Room.databaseBuilder(context, AppDatabase::class.java, "label.db")
                .build().also { INSTANCE = it }
        }
    }
}
