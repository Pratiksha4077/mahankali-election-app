package expo.modules.devicetelephony

import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DeviceTelephonyModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exception("React Application Context is unavailable")

  override fun definition() = ModuleDefinition {
    Name("DeviceTelephony")

    Function("isAvailable") {
      return@Function true
    }

    Function("getCallLogs") { limit: Int?, offset: Int? ->
      val result = mutableListOf<Map<String, Any>>()
      val hasPermission = ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
      Log.d("DeviceTelephony", "getCallLogs invoked - READ_CALL_LOG permission granted: $hasPermission")
      if (!hasPermission) {
        return@Function result
      }

      val maxLimit = if (limit != null && limit in 1..500) limit else 50
      val skipCount = if (offset != null && offset > 0) offset else 0
      val projection = arrayOf(
        CallLog.Calls._ID,
        CallLog.Calls.NUMBER,
        CallLog.Calls.CACHED_NAME,
        CallLog.Calls.TYPE,
        CallLog.Calls.DATE,
        CallLog.Calls.DURATION
      )
      // Standard Android sort order without raw SQL LIMIT clause (broadly compatible across all Android OS versions & OEMs)
      val sortOrder = "${CallLog.Calls.DATE} DESC"

      try {
        val cursor = context.contentResolver.query(
          CallLog.Calls.CONTENT_URI,
          projection,
          null,
          null,
          sortOrder
        )

        cursor?.use {
          val idCol = it.getColumnIndex(CallLog.Calls._ID)
          val numCol = it.getColumnIndex(CallLog.Calls.NUMBER)
          val nameCol = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
          val typeCol = it.getColumnIndex(CallLog.Calls.TYPE)
          val dateCol = it.getColumnIndex(CallLog.Calls.DATE)
          val durCol = it.getColumnIndex(CallLog.Calls.DURATION)

          var skipped = 0
          var count = 0
          while (it.moveToNext()) {
            if (skipped < skipCount) {
              skipped++
              continue
            }
            if (count >= maxLimit) {
              break
            }

            val typeInt = if (typeCol != -1) it.getInt(typeCol) else 0
            val typeStr = when (typeInt) {
              CallLog.Calls.INCOMING_TYPE -> "INCOMING"
              CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
              CallLog.Calls.MISSED_TYPE -> "MISSED"
              CallLog.Calls.REJECTED_TYPE -> "REJECTED"
              else -> "OTHER"
            }

            val map = mutableMapOf<String, Any>()
            if (idCol != -1) map["id"] = it.getString(idCol) ?: ""
            if (numCol != -1) map["phoneNumber"] = it.getString(numCol) ?: ""
            if (nameCol != -1) map["name"] = it.getString(nameCol) ?: ""
            map["callType"] = typeStr
            if (dateCol != -1) map["timestamp"] = it.getLong(dateCol)
            if (durCol != -1) map["duration"] = it.getInt(durCol)
            result.add(map)
            count++
          }
        }
        Log.d("DeviceTelephony", "getCallLogs successfully extracted ${result.size} records (offset=$skipCount, limit=$maxLimit)")
      } catch (e: Exception) {
        Log.e("DeviceTelephony", "Error querying CallLog.Calls: ${e.message}", e)
      }

      return@Function result
    }

    Function("getSmsMetadata") { limit: Int?, offset: Int? ->
      val result = mutableListOf<Map<String, Any>>()
      val hasPermission = ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
      Log.d("DeviceTelephony", "getSmsMetadata invoked - READ_SMS permission granted: $hasPermission")
      if (!hasPermission) {
        return@Function result
      }

      val maxLimit = if (limit != null && limit in 1..500) limit else 50
      val skipCount = if (offset != null && offset > 0) offset else 0
      val projection = arrayOf(
        Telephony.Sms._ID,
        Telephony.Sms.ADDRESS,
        Telephony.Sms.DATE,
        Telephony.Sms.TYPE,
        Telephony.Sms.BODY
      )
      // Standard Android sort order without raw SQL LIMIT clause
      val sortOrder = "${Telephony.Sms.DATE} DESC"

      try {
        val cursor = context.contentResolver.query(
          Telephony.Sms.CONTENT_URI,
          projection,
          null,
          null,
          sortOrder
        )

        cursor?.use {
          val idCol = it.getColumnIndex(Telephony.Sms._ID)
          val addrCol = it.getColumnIndex(Telephony.Sms.ADDRESS)
          val dateCol = it.getColumnIndex(Telephony.Sms.DATE)
          val typeCol = it.getColumnIndex(Telephony.Sms.TYPE)
          val bodyCol = it.getColumnIndex(Telephony.Sms.BODY)

          var skipped = 0
          var count = 0
          while (it.moveToNext()) {
            if (skipped < skipCount) {
              skipped++
              continue
            }
            if (count >= maxLimit) {
              break
            }

            val typeInt = if (typeCol != -1) it.getInt(typeCol) else 0
            val typeStr = when (typeInt) {
              Telephony.Sms.MESSAGE_TYPE_INBOX -> "INBOX"
              Telephony.Sms.MESSAGE_TYPE_SENT -> "SENT"
              Telephony.Sms.MESSAGE_TYPE_OUTBOX -> "OUTBOX"
              Telephony.Sms.MESSAGE_TYPE_FAILED -> "FAILED"
              else -> "OTHER"
            }

            val rawBody = if (bodyCol != -1) it.getString(bodyCol) ?: "" else ""
            val preview = if (rawBody.isNotBlank()) {
              val clean = rawBody.trim().replace("\n", " ").replace("\r", " ")
              if (clean.length > 60) clean.take(57) + "..." else clean
            } else ""

            val map = mutableMapOf<String, Any>()
            if (idCol != -1) map["id"] = it.getString(idCol) ?: ""
            if (addrCol != -1) map["address"] = it.getString(addrCol) ?: ""
            map["smsType"] = typeStr
            if (dateCol != -1) map["timestamp"] = it.getLong(dateCol)
            map["preview"] = preview
            result.add(map)
            count++
          }
        }
        Log.d("DeviceTelephony", "getSmsMetadata successfully extracted ${result.size} metadata records (offset=$skipCount, limit=$maxLimit)")
      } catch (e: Exception) {
        Log.e("DeviceTelephony", "Error querying Telephony.Sms: ${e.message}", e)
      }

      return@Function result
    }
  }
}

