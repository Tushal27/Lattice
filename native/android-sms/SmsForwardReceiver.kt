package app.lattice.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Listens for incoming SMS at the OS level and forwards payment-looking messages
 * to Lattice's /api/sms webhook. Works even when the app is closed — this is the
 * whole reason for going native (the web can't read SMS). The server does the
 * real parsing/dedupe; we only pre-filter obvious non-payment texts to avoid
 * shipping personal messages off the phone.
 *
 * Config comes from res/values/lattice.xml: `lattice_ingest_url` and
 * `lattice_ingest_secret` (see NATIVE_APP.md).
 */
class SmsForwardReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        // A single SMS can arrive as multiple parts — concatenate the bodies.
        val body = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            ?.joinToString("") { it.messageBody ?: "" }
            ?.trim()
            .orEmpty()
        if (body.isEmpty() || !looksLikePayment(body)) return

        val url = context.getString(R.string.lattice_ingest_url)
        val secret = context.getString(R.string.lattice_ingest_secret)
        if (url.isBlank()) return

        // Network off the main thread; goAsync keeps the receiver alive for it.
        val pending = goAsync()
        thread {
            try {
                post(url, secret, body)
            } catch (e: Exception) {
                Log.w("LatticeSms", "forward failed", e)
            } finally {
                pending.finish()
            }
        }
    }

    private fun looksLikePayment(text: String): Boolean {
        val t = text.lowercase()
        val moneyWords = listOf(
            "debited", "credited", "spent", "paid", "purchase", "txn", "transaction",
            "upi", "a/c", "acct", "account", "rs.", "rs ", "inr", "₹", "withdrawn",
        )
        return moneyWords.any { t.contains(it) }
    }

    private fun post(endpoint: String, secret: String, body: String) {
        val conn = URL(endpoint).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 15000
        conn.readTimeout = 15000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        if (secret.isNotBlank()) conn.setRequestProperty("Authorization", "Bearer $secret")
        val payload = JSONObject().put("text", body).toString()
        conn.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
        val code = conn.responseCode
        Log.i("LatticeSms", "forwarded SMS → $code")
        conn.disconnect()
    }
}
