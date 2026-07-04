package app.lattice.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Listens for incoming SMS at the OS level and forwards payment-looking messages
 * to Lattice's /api/sms webhook. Works even when the app is closed — this is the
 * whole reason for going native (the web can't read SMS). The server does the
 * real parsing/dedupe; we only pre-filter obvious non-payment texts so personal
 * messages never leave the phone. URL + secret come from SmsConfig.
 */
public class SmsForwardReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(final Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        // A single SMS can arrive as multiple parts — concatenate the bodies.
        StringBuilder sb = new StringBuilder();
        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages != null) {
            for (SmsMessage m : messages) {
                if (m != null && m.getMessageBody() != null) sb.append(m.getMessageBody());
            }
        }
        final String body = sb.toString().trim();
        if (body.isEmpty() || !looksLikePayment(body)) return;

        final String url = SmsConfig.url(context);
        final String secret = SmsConfig.secret(context);
        if (url == null || url.trim().isEmpty()) return;

        // Network off the main thread; goAsync keeps the receiver alive for it.
        final PendingResult pending = goAsync();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    post(url, secret, body);
                } catch (Exception e) {
                    Log.w("LatticeSms", "forward failed", e);
                } finally {
                    pending.finish();
                }
            }
        }).start();
    }

    private boolean looksLikePayment(String text) {
        String t = text.toLowerCase();
        String[] words = {
            "debited", "credited", "spent", "paid", "purchase", "txn", "transaction",
            "upi", "a/c", "acct", "account", "rs.", "rs ", "inr", "₹", "withdrawn",
        };
        for (String w : words) if (t.contains(w)) return true;
        return false;
    }

    private void post(String endpoint, String secret, String body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(endpoint).openConnection();
        conn.setRequestMethod("POST");
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json");
        if (secret != null && !secret.trim().isEmpty()) {
            conn.setRequestProperty("Authorization", "Bearer " + secret);
        }
        String payload = new JSONObject().put("text", body).toString();
        OutputStream os = conn.getOutputStream();
        os.write(payload.getBytes("UTF-8"));
        os.close();
        int code = conn.getResponseCode();
        Log.i("LatticeSms", "forwarded SMS -> " + code);
        conn.disconnect();
    }
}
