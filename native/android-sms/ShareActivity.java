package app.lattice.mobile;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;

/**
 * Receives content shared from any app (Share → Lattice) and captures it: a link
 * gets its page ingested, anything else is filed as a note by the agent. No UI —
 * a translucent flash + a toast, so it feels instant.
 */
public class ShareActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final String text = extract(getIntent());
        if (text == null || text.trim().isEmpty()) {
            Toast.makeText(this, "Nothing to save", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        final String url = SmsConfig.captureUrl(this);
        final String secret = SmsConfig.secret(this);
        Toast.makeText(this, "Saving to Lattice…", Toast.LENGTH_SHORT).show();
        new Thread(new Runnable() {
            @Override
            public void run() {
                String msg;
                try {
                    int code = LatticeApi.postText(url, secret, text);
                    msg = code < 300 ? "Saved to Lattice ✓" : "Couldn't save (" + code + ")";
                } catch (Exception e) {
                    msg = "Couldn't save: " + e.getMessage();
                }
                final String result = msg;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(getApplicationContext(), result, Toast.LENGTH_LONG).show();
                        finish();
                    }
                });
            }
        }).start();
    }

    private String extract(Intent i) {
        if (i == null) return null;
        String body = i.getStringExtra(Intent.EXTRA_TEXT);
        String subject = i.getStringExtra(Intent.EXTRA_SUBJECT);
        if (body == null) return subject;
        if (subject != null && !body.contains(subject)) return subject + " — " + body;
        return body;
    }
}
