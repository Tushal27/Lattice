package app.lattice.mobile;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.widget.Toast;

import java.util.ArrayList;

/**
 * Voice quick-capture: opens the system speech recognizer, then files whatever
 * you say via the agent — "speak to save". A separate "Lattice Voice" launcher
 * entry; uses Google's recognizer UI, so no in-app mic permission needed.
 */
public class VoiceActivity extends Activity {
    private static final int REQ_SPEECH = 55;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to capture…");
        try {
            startActivityForResult(i, REQ_SPEECH);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No speech recognizer available", Toast.LENGTH_LONG).show();
            finish();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_SPEECH || resultCode != RESULT_OK || data == null) {
            finish();
            return;
        }
        ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        final String text = (results != null && !results.isEmpty()) ? results.get(0) : "";
        if (text.trim().isEmpty()) {
            finish();
            return;
        }
        final String url = SmsConfig.captureUrl(this);
        final String secret = SmsConfig.secret(this);
        Toast.makeText(this, "Saving…", Toast.LENGTH_SHORT).show();
        new Thread(new Runnable() {
            @Override
            public void run() {
                String msg;
                try {
                    int code = LatticeApi.postText(url, secret, text);
                    msg = code < 300 ? "Saved: " + text : "Couldn't save (" + code + ")";
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
}
