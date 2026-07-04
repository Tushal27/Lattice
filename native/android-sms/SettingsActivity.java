package app.lattice.mobile;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * A tiny native screen to set the SMS webhook URL + secret on the phone — so
 * these can change without ever rebuilding the app. Shows as a separate
 * "Lattice SMS" launcher entry. Includes a "Send test" button that hits the
 * endpoint so you can confirm it works end to end.
 */
public class SettingsActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_lattice_settings);

        final EditText urlField = findViewById(R.id.url);
        final EditText secretField = findViewById(R.id.secret);
        urlField.setText(SmsConfig.url(this));
        String sec = SmsConfig.secret(this);
        if (sec != null && sec.contains("REPLACE")) sec = ""; // hide the placeholder default
        secretField.setText(sec);

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
    }

    private String sendTest(String u, String s) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(u).openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        conn.setRequestProperty("Content-Type", "application/json");
        if (!s.isEmpty()) conn.setRequestProperty("Authorization", "Bearer " + s);
        String payload = new JSONObject().put("text", "Test: debited Rs 1.00 at LATTICE via UPI").toString();
        OutputStream os = conn.getOutputStream();
        os.write(payload.getBytes("UTF-8"));
        os.close();
        int code = conn.getResponseCode();
        conn.disconnect();
        return "Server responded " + code;
    }
}
