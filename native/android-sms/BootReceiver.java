package app.lattice.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restart the SMS watcher after a reboot so capture survives without opening the app. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            SmsWatchService.start(context);
        }
    }
}
