package app.lattice.mobile;

import com.google.firebase.messaging.FirebaseMessagingService;

/**
 * Receives FCM lifecycle callbacks. We only need onNewToken → register it;
 * "notification" messages from the server are displayed by the system
 * automatically when the app is backgrounded. Only compiled into FCM-enabled
 * builds (copied by native-patch.mjs when google-services.json is present).
 */
public class FcmService extends FirebaseMessagingService {
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        PushRegister.send(getApplicationContext(), token);
    }
}
