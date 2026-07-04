package app.lattice.mobile;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Runtime config for the SMS forwarder — the webhook URL and secret. Stored in
 * SharedPreferences and editable from SettingsActivity, so you can change them
 * on the phone WITHOUT rebuilding the app. Falls back to the string-resource
 * defaults baked at build time (res/values/lattice.xml).
 */
public final class SmsConfig {
    private static final String PREFS = "lattice_prefs";

    private SmsConfig() {}

    public static String url(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String v = p.getString("url", null);
        if (v != null && !v.trim().isEmpty()) return v.trim();
        return ctx.getString(R.string.lattice_ingest_url);
    }

    public static String secret(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String v = p.getString("secret", null);
        if (v != null && !v.trim().isEmpty()) return v.trim();
        return ctx.getString(R.string.lattice_ingest_secret);
    }

    public static void save(Context ctx, String url, String secret) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString("url", url == null ? "" : url.trim())
            .putString("secret", secret == null ? "" : secret.trim())
            .apply();
    }
}
