package com.labelapp.label

import android.graphics.*
import com.labelapp.data.Product

object LabelRenderer {
    const val WIDTH = 384
    const val HEIGHT = 200

    fun renderToBytes(product: Product, iconBitmap: Bitmap?): ByteArray {
        val bmp = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        canvas.drawColor(Color.WHITE)

        // icon at (8,8) size 80×80
        iconBitmap?.let {
            val scaled = Bitmap.createScaledBitmap(it, 80, 80, true)
            canvas.drawBitmap(scaled, 8f, 8f, null)
        }

        // name at (96, 8) font 24 — wraps to max_width = 384-96-8 = 280
        val namePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = 24f
            typeface = Typeface.SANS_SERIF
        }
        val nameLines = wrapText(product.name, namePaint, 280f)
        val lineH = (24 * 1.25f).toInt()
        nameLines.forEachIndexed { i, line ->
            // drawText y = baseline; add textSize to convert from top-left to baseline
            canvas.drawText(line, 96f, 8f + 24f + i * lineH, namePaint)
        }

        // inventory number at (192, 90) font 48
        val numPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = 48f
            typeface = Typeface.SANS_SERIF
        }
        canvas.drawText("#${product.inventoryNumber}", 192f, 90f + 48f, numPaint)

        // date at (8, 170) font 18
        val datePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = 18f
            typeface = Typeface.SANS_SERIF
        }
        canvas.drawText(product.createdAt, 8f, 170f + 18f, datePaint)

        return bitmapToPrinterBytes(bmp)
    }

    private fun wrapText(text: String, paint: Paint, maxWidth: Float): List<String> {
        val words = text.split(" ")
        val lines = mutableListOf<String>()
        var current = ""
        for (word in words) {
            val candidate = if (current.isEmpty()) word else "$current $word"
            if (paint.measureText(candidate) <= maxWidth) {
                current = candidate
            } else {
                if (current.isNotEmpty()) lines.add(current)
                current = word
            }
        }
        if (current.isNotEmpty()) lines.add(current)
        return lines.ifEmpty { listOf("") }
    }

    // Convert ARGB bitmap → printer row bytes (48 bytes/row, LSB-first, black=1)
    private fun bitmapToPrinterBytes(bmp: Bitmap): ByteArray {
        val out = ByteArray(HEIGHT * 48)
        for (y in 0 until HEIGHT) {
            for (x in 0 until WIDTH) {
                val pixel = bmp.getPixel(x, y)
                val lum = (Color.red(pixel) + Color.green(pixel) + Color.blue(pixel)) / 3
                if (lum < 128) {
                    val byteIdx = y * 48 + x / 8
                    out[byteIdx] = (out[byteIdx].toInt() or (1 shl (x % 8))).toByte()
                }
            }
        }
        return out
    }
}
