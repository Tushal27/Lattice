package app.lattice.mobile;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Tiny shared HTTP helper: POST {"text": …} to a Lattice endpoint with the Bearer secret. */
final class LatticeApi {
    private LatticeApi() {}

    static int postText(String endpoint, String secret, String text) throws Exception {
        return post(endpoint, secret, new JSONObject().put("text", text).toString());
    }

    static int postToken(String endpoint, String secret, String token) throws Exception {
        return post(endpoint, secret, new JSONObject().put("token", token).toString());
    }

    private static int post(String endpoint, String secret, String payload) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(endpoint).openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("Content-Type", "application/json");
        if (secret != null && !secret.trim().isEmpty()) {
            conn.setRequestProperty("Authorization", "Bearer " + secret);
        }
        OutputStream os = conn.getOutputStream();
        os.write(payload.getBytes("UTF-8"));
        os.close();
        int code = conn.getResponseCode();
        conn.disconnect();
        return code;
    }
}
