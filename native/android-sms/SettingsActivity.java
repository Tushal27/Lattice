package app.lattice.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * A tiny native screen to set the SMS webhook URL + secret on the phone — so
 * these can change without ever rebuilding the app. Shows as a separate
 * "Lattice SMS" launcher entry. Also requests the RECEIVE_SMS runtime permission
 * (without it, Android never delivers incoming SMS to our receiver) and shows a
 * live permission status. Includes a "Send test" button.
 */
public class SettingsActivity extends Activity {
    private static final int REQ_SMS = 101;
    private static final int REQ_NOTIF = 102;
    private TextView permStatus;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_lattice_settings);

        permStatus = findViewById(R.id.permStatus);
        final EditText urlField = findViewById(R.id.url);
        final EditText secretField = findViewById(R.id.secret);
        urlField.setText(SmsConfig.url(this));
        String sec = SmsConfig.secret(this);
        if (sec != null && sec.contains("REPLACE")) sec = ""; // hide the placeholder default
        secretField.setText(sec);

        findViewById(R.id.grant).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                requestSms();
            }
        });

        findViewById(R.id.save).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                SmsConfig.save(SettingsActivity.this, urlField.getText().toString(), secretField.getText().toString());
                Toast.makeText(SettingsActivity.this, "Saved", Toast.LENGTH_SHORT).show();
            }
        });

        findViewById(R.id.test).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                final String u = urlField.getText().toString().trim();
                final String s = secretField.getText().toString().trim();
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        String r;
                        try {
                            r = sendTest(u, s);
                        } catch (Exception e) {
                            r = "Failed: " + e.getMessage();
                        }
                        final String result = r;
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(SettingsActivity.this, result, Toast.LENGTH_LONG).show();
                            }
                        });
                    }
                }).start();
            }
        });

        // Ask up front — incoming SMS won't reach the receiver until this is granted.
        requestSms();
        requestNotifications();
        registerPush();
    }

    private void requestNotifications() {
        if (Build.VERSION.SDK_INT >= 33
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
        }
    }

    // Register the FCM token, if this is an FCM-enabled build. Reflective so the
    // app still compiles when PushRegister/Firebase aren't included.
    private void registerPush() {
        try {
            Class<?> c = Class.forName("app.lattice.mobile.PushRegister");
            c.getMethod("registerOnStart", android.content.Context.class).invoke(null, this);
        } catch (Throwable ignored) {
        }
    }

    private boolean hasSms() {
        if (Build.VERSION.SDK_INT < 23) return true;
        return checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestSms() {
        if (hasSms()) {
            updatePermStatus();
            SmsWatchService.start(this); // permission present → keep the watcher alive
            return;
        }
        if (Build.VERSION.SDK_INT >= 23) {
            requestPermissions(new String[]{Manifest.permission.RECEIVE_SMS}, REQ_SMS);
        }
    }

    private void updatePermStatus() {
        if (permStatus == null) return;
        if (hasSms()) {
            permStatus.setText("✓ SMS permission granted");
            permStatus.setTextColor(0xFF34D399);
        } else {
            permStatus.setText("⚠ SMS permission needed — tap “Grant SMS permission”. Also enable Auto-start for Lattice.");
            permStatus.setTextColor(0xFFFBBF24);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        updatePermStatus();
        if (requestCode == REQ_SMS) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) SmsWatchService.start(this);
            Toast.makeText(this, granted ? "SMS capture enabled" : "SMS permission denied", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        updatePermStatus();
    }

    private String sendTest(String u, String s) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(u).openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        conn.setRequestProperty("Content-Type", "application/json");
        if (!s.isEmpty()) conn.setRequestProperty("Authorization", "Bearer " + s);
        // A realistic debit SMS, made unique so it isn't deduped or judged a promo.
        String sms = "Rs 1.00 debited from A/c XX1234 to LATTICE via UPI Ref " + System.currentTimeMillis() + ".";
        String payload = new JSONObject().put("text", sms).toString();
        OutputStream os = conn.getOutputStream();
        os.write(payload.getBytes("UTF-8"));
        os.close();
        int code = conn.getResponseCode();
        // Show the server's decision (created vs skipped + why), not just the code.
        java.io.InputStream in = code < 400 ? conn.getInputStream() : conn.getErrorStream();
        StringBuilder body = new StringBuilder();
        if (in != null) {
            byte[] buf = new byte[1024];
            int n;
            while ((n = in.read(buf)) > 0) body.append(new String(buf, 0, n, "UTF-8"));
            in.close();
        }
        conn.disconnect();
        String b = body.toString();
        if (b.length() > 160) b = b.substring(0, 160);
        return "HTTP " + code + " · " + b;
    }
}
