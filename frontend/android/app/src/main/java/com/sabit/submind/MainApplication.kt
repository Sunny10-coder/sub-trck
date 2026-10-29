package com.sabit.submind

import android.app.Application
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

class MainApplication : Application(), ReactApplication {

  companion object {
    var startupError: String? = null
    val breadcrumbs = StringBuilder()

    fun log(msg: String) {
      Log.i("SubMind", msg)
      synchronized(breadcrumbs) {
        breadcrumbs.append("[${System.currentTimeMillis() % 100000}] ").append(msg).append("\n")
      }
    }

    fun writeCrashToStorage(context: Context, text: String) {
      try {
        File(context.filesDir, "submind_crash.txt").writeText(text)
      } catch (ignored: Throwable) {}

      try {
        val ext = context.getExternalFilesDir(null)
        if (ext != null) {
          File(ext, "submind_crash.txt").writeText(text)
        }
      } catch (ignored: Throwable) {}

      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, "submind_crash.txt")
            put(MediaStore.Downloads.MIME_TYPE, "text/plain")
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
          }
          val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
          if (uri != null) {
            context.contentResolver.openOutputStream(uri)?.use { os ->
              os.write(text.toByteArray())
            }
          }
        } else {
          val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
          if (dir != null && dir.exists()) {
            File(dir, "submind_crash.txt").writeText(text)
          }
        }
      } catch (e: Throwable) {
        Log.e("SubMind", "Could not write crash to Downloads", e)
      }
    }
  }

  override val reactHost: ReactHost by lazy {
    log("Initializing reactHost via ExpoReactHostFactory")
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    log("MainApplication.onCreate started")

    val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
      val sw = StringWriter()
      throwable.printStackTrace(PrintWriter(sw))
      val crashText = "THREAD: ${thread.name}\n\nEXCEPTION:\n$sw\n\nBREADCRUMBS:\n$breadcrumbs"
      Log.e("SubMind", "FATAL UNCAUGHT EXCEPTION:\n$crashText", throwable)

      writeCrashToStorage(this@MainApplication, crashText)

      try {
        val intent = Intent(this@MainApplication, CrashActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          putExtra("error", crashText)
        }
        startActivity(intent)
      } catch (e: Throwable) {
        Log.e("SubMind", "Failed to launch CrashActivity from handler", e)
        defaultHandler?.uncaughtException(thread, throwable)
      }
    }

    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }

    try {
      log("Calling loadReactNative")
      loadReactNative(this)
      log("loadReactNative completed successfully")
    } catch (t: Throwable) {
      val sw = StringWriter()
      t.printStackTrace(PrintWriter(sw))
      startupError = "loadReactNative failed:\n$sw"
      log("loadReactNative failed: $t")
      writeCrashToStorage(this, startupError!!)
    }

    try {
      log("Calling ApplicationLifecycleDispatcher.onApplicationCreate")
      ApplicationLifecycleDispatcher.onApplicationCreate(this)
      log("ApplicationLifecycleDispatcher.onApplicationCreate completed successfully")
    } catch (t: Throwable) {
      val sw = StringWriter()
      t.printStackTrace(PrintWriter(sw))
      if (startupError == null) {
        startupError = "ApplicationLifecycleDispatcher failed:\n$sw"
      }
      log("ApplicationLifecycleDispatcher failed: $t")
      writeCrashToStorage(this, "ApplicationLifecycleDispatcher failed:\n$sw")
    }

    log("MainApplication.onCreate finished")
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
