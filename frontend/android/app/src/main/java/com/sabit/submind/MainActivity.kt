package com.sabit.submind

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.TypedValue
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

import java.io.PrintWriter
import java.io.StringWriter

class MainActivity : ReactActivity() {

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    MainApplication.log("MainActivity.onCreate started")

    if (MainApplication.startupError != null) {
      MainApplication.log("Displaying MainApplication.startupError on screen")
      showErrorUI(MainApplication.startupError!! + "\n\nBREADCRUMBS:\n" + MainApplication.breadcrumbs)
      return
    }

    try {
      MainApplication.log("Calling super.onCreate(null)")
      super.onCreate(null)
      MainApplication.log("super.onCreate(null) returned successfully")
    } catch (t: Throwable) {
      val sw = StringWriter()
      t.printStackTrace(PrintWriter(sw))
      val crashText = "MainActivity.super.onCreate crashed:\n\n$sw\n\nBREADCRUMBS:\n" + MainApplication.breadcrumbs
      Log.e("MainActivity", "Fatal in super.onCreate", t)
      MainApplication.writeCrashToStorage(this, crashText)
      showErrorUI(crashText)
      return
    }
  }

  private fun showErrorUI(message: String) {
    try {
      setTheme(R.style.AppTheme)
      val root = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundColor(Color.parseColor("#0F172A"))
        setPadding(40, 70, 40, 60)
      }

      val title = TextView(this).apply {
        text = "SUBMIND DIAGNOSTIC REPORT"
        setTextColor(Color.parseColor("#EF4444"))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
        setTypeface(null, Typeface.BOLD)
        setPadding(0, 0, 0, 16)
      }
      root.addView(title)

      val copyBtn = Button(this).apply {
        text = "Copy Diagnostic Report to Clipboard"
        setBackgroundColor(Color.parseColor("#2563EB"))
        setTextColor(Color.WHITE)
        setOnClickListener {
          val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
          val clip = ClipData.newPlainText("SubMind Crash", message)
          cm.setPrimaryClip(clip)
          Toast.makeText(this@MainActivity, "Report copied to clipboard!", Toast.LENGTH_SHORT).show()
        }
      }
      root.addView(copyBtn)

      val scrollView = ScrollView(this).apply {
        layoutParams = LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          0,
          1f
        ).apply {
          topMargin = 24
        }
      }

      val tv = TextView(this).apply {
        text = message
        setTextColor(Color.parseColor("#E2E8F0"))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        setTextIsSelectable(true)
      }
      scrollView.addView(tv)
      root.addView(scrollView)

      setContentView(root)
    } catch (e: Throwable) {
      Log.e("MainActivity", "showErrorUI failed", e)
    }
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              super.invokeDefaultOnBackPressed()
          }
          return
      }
      super.invokeDefaultOnBackPressed()
  }
}
