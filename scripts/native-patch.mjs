// Injects Lattice's native SMS pieces into the Capacitor-generated android/
// project: the Java sources, the settings layout, the config string-resource,
// and the AndroidManifest entries (permissions + receiver + settings activity).
//
// Idempotent — safe to run repeatedly. Run AFTER `cap add android` and BEFORE
// `cap sync`. The CI workflow calls it; you can also run it locally:
//   node scripts/native-patch.mjs
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "native", "android-sms");
const APP = path.join(ROOT, "android", "app", "src", "main");
const PKG = path.join(APP, "java", "app", "lattice", "mobile");

async function copy(from, to) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
  console.log(`copied ${path.relative(ROOT, to)}`);
}

async function writeConfigResource() {
  const url = process.env.LATTICE_INGEST_URL || "https://lattice-pink.vercel.app/api/sms";
  const secret = process.env.LATTICE_INGEST_SECRET || "REPLACE_WITH_YOUR_SECRET";
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="lattice_ingest_url">${url}</string>
    <string name="lattice_ingest_secret">${secret}</string>
</resources>
`;
  const dest = path.join(APP, "res", "values", "lattice.xml");
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, xml);
  console.log(`wrote ${path.relative(ROOT, dest)} (url=${url}, secret ${secret === "REPLACE_WITH_YOUR_SECRET" ? "NOT set" : "set"})`);
}

async function patchVersion() {
  // versionCode must strictly increase for Android to treat a reinstall as an
  // upgrade. Drive it from the CI run number; name from the tag when present.
  const code = parseInt(process.env.LATTICE_VERSION_CODE || process.env.GITHUB_RUN_NUMBER || "1", 10) || 1;
  let name = process.env.LATTICE_VERSION_NAME;
  if (!name && process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME) {
    name = process.env.GITHUB_REF_NAME.replace(/^v/, "");
  }
  if (!name) name = `1.0.${code}`;

  const file = path.join(ROOT, "android", "app", "build.gradle");
  let gradle = await fs.readFile(file, "utf8");
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${code}`);
  gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${name}"`);
  await fs.writeFile(file, gradle);
  console.log(`set versionCode ${code}, versionName ${name}`);
}

async function patchManifest() {
  const file = path.join(APP, "AndroidManifest.xml");
  let xml = await fs.readFile(file, "utf8");

  const permissions = `    <uses-permission android:name="android.permission.RECEIVE_SMS" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
`;
  if (!xml.includes("android.permission.RECEIVE_SMS")) {
    xml = xml.replace(/(<application\b)/, `${permissions}\n    $1`);
    console.log("added SMS/INTERNET/foreground-service/boot permissions");
  }

  const components = `
        <receiver
            android:name=".SmsForwardReceiver"
            android:exported="true"
            android:permission="android.permission.BROADCAST_SMS">
            <intent-filter android:priority="999">
                <action android:name="android.provider.Telephony.SMS_RECEIVED" />
            </intent-filter>
        </receiver>

        <activity
            android:name=".SettingsActivity"
            android:exported="true"
            android:label="Lattice SMS">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".SmsWatchService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="payment_sms_capture" />
        </service>

        <receiver
            android:name=".BootReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>

        <activity
            android:name=".ShareActivity"
            android:exported="true"
            android:label="Save to Lattice"
            android:excludeFromRecents="true"
            android:theme="@android:style/Theme.Translucent.NoTitleBar">
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>
        </activity>

        <activity
            android:name=".VoiceActivity"
            android:exported="true"
            android:label="Lattice Voice"
            android:theme="@android:style/Theme.Translucent.NoTitleBar">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
`;
  if (!xml.includes(".SmsForwardReceiver")) {
    xml = xml.replace(/(<\/application>)/, `${components}    $1`);
    console.log("added receiver + settings + watch service + boot + share + voice");
  }

  await fs.writeFile(file, xml);
}

async function main() {
  await copy(path.join(SRC, "SmsConfig.java"), path.join(PKG, "SmsConfig.java"));
  await copy(path.join(SRC, "SmsForwardReceiver.java"), path.join(PKG, "SmsForwardReceiver.java"));
  await copy(path.join(SRC, "SettingsActivity.java"), path.join(PKG, "SettingsActivity.java"));
  await copy(path.join(SRC, "SmsWatchService.java"), path.join(PKG, "SmsWatchService.java"));
  await copy(path.join(SRC, "BootReceiver.java"), path.join(PKG, "BootReceiver.java"));
  await copy(path.join(SRC, "LatticeApi.java"), path.join(PKG, "LatticeApi.java"));
  await copy(path.join(SRC, "ShareActivity.java"), path.join(PKG, "ShareActivity.java"));
  await copy(path.join(SRC, "VoiceActivity.java"), path.join(PKG, "VoiceActivity.java"));
  await copy(
    path.join(SRC, "activity_lattice_settings.xml"),
    path.join(APP, "res", "layout", "activity_lattice_settings.xml"),
  );
  await writeConfigResource();
  await patchVersion();
  await patchManifest();
  console.log("native patch complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
