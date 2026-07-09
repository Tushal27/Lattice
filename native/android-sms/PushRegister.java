package app.lattice.mobile;

import android.content.Context;

import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Registers the device's FCM token with Lattice so briefs/nudges can reach the
 * native app. Only compiled into FCM-enabled builds (copied by native-patch.mjs
 * when a google-services.json is present); SettingsActivity calls
 * registerOnStart(...) reflectively so non-FCM builds still compile.
 */
public final class PushRegister {
    private PushRegister() {}

    /** Called (reflectively) on app open — fetch the current token and register it. */
    public static void registerOnStart(final Context ctx) {
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(new OnCompleteListener<String>() {
                @Override
                public void onComplete(Task<String> task) {
                    if (task.isSuccessful() && task.getResult() != null) {
                        send(ctx, task.getResult());
                    }
                }
            });
        } catch (Throwable ignored) {
        }
    }

    static void send(final Context ctx, final String token) {
        if (token == null || token.trim().isEmpty()) return;
        final String url = registerUrl(ctx);
        final String secret = SmsConfig.secret(ctx);
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    LatticeApi.postToken(url, secret, token);
                } catch (Exception ignored) {
                }
            }
        }).start();
    }

    private static String registerUrl(Context ctx) {
        String u = SmsConfig.url(ctx);
        int idx = u.indexOf("/api/");
        String base = idx > 0 ? u.substring(0, idx) : u.replaceAll("/+$", "");
        return base + "/api/push/register-fcm";
    }
}
