package app.lattice.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.IBinder;

/**
 * A persistent foreground service that keeps a live SMS receiver — the reason
 * MacroDroid works and a bare manifest receiver doesn't on aggressive ROMs
 * (MIUI/ColorOS/Funtouch), which withhold background broadcasts. Registering the
 * receiver here, inside a foreground service, makes SMS delivery reliable even
 * when the app is swiped away. Started on app open and on boot.
 */
public class SmsWatchService extends Service {
    private static final String CHANNEL = "lattice_sms_capture";
    private SmsForwardReceiver receiver;

    @Override
    public void onCreate() {
        super.onCreate();
        startForegroundNotification();
        receiver = new SmsForwardReceiver();
        IntentFilter filter = new IntentFilter("android.provider.Telephony.SMS_RECEIVED");
        filter.setPriority(999);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(receiver, filter);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY; // restart if the OS kills us
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (receiver != null) {
            try {
                unregisterReceiver(receiver);
            } catch (Exception ignored) {
            }
        }
    }

    private void startForegroundNotification() {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Payment capture", NotificationManager.IMPORTANCE_MIN);
            ch.setShowBadge(false);
            if (nm != null) nm.createNotificationChannel(ch);
            b = new Notification.Builder(this, CHANNEL);
        } else {
            b = new Notification.Builder(this);
        }
        Notification n = b
            .setContentTitle("Lattice")
            .setContentText("Watching for payment SMS")
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setOngoing(true)
            .build();
        startForeground(7, n);
    }

    /** Start the watcher (foreground service on O+). */
    public static void start(Context ctx) {
        Intent svc = new Intent(ctx, SmsWatchService.class);
        if (Build.VERSION.SDK_INT >= 26) {
            ctx.startForegroundService(svc);
        } else {
            ctx.startService(svc);
        }
    }
}
