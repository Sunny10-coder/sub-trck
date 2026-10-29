package com.sabit.submind

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.util.TypedValue
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

class CrashActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val error = intent.getStringExtra("error") ?: "No error details available"

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.parseColor("#0F172A"))
      setPadding(40, 60, 40, 60)
    }

    val header = TextView(this).apply {
      text = "SUBMIND DIAGNOSTIC ERROR"
      setTextColor(Color.parseColor("#EF4444"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
      setTypeface(null, android.graphics.Typeface.BOLD)
      setPadding(0, 0, 0, 20)
    }
    root.addView(header)

    val copyButton = Button(this).apply {
      text = "Copy Error to Clipboard"
      setBackgroundColor(Color.parseColor("#3B82F6"))
      setTextColor(Color.WHITE)
      setOnClickListener {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("SubMind Crash", error)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(this@CrashActivity, "Copied to clipboard", Toast.LENGTH_SHORT).show()
      }
    }
    root.addView(copyButton)

    val scrollView = ScrollView(this).apply {
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        0,
        1f
      ).apply {
        topMargin = 30
      }
    }

    val textView = TextView(this).apply {
      text = error
      setTextColor(Color.parseColor("#E2E8F0"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
      setTextIsSelectable(true)
    }

    scrollView.addView(textView)
    root.addView(scrollView)
    setContentView(root)
  }
}
