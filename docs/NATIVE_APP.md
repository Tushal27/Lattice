# Lattice — native Android app (Capacitor)

Lattice runs as a PWA, but one thing the web genuinely can't do is **read
incoming SMS** — which is what makes hands-free spending capture reliable. So we
wrap the existing app in a thin **Capacitor** shell: it loads the live app in a
native WebView (no UI rewrite, backend unchanged) and adds a native SMS receiver
that forwards payment texts to `/api/sms` **even when the app is closed**. No
MacroDroid, no keeping anything open.

This same shell is the base for any future native need (push, share-to-Lattice,
widgets, biometric lock).

> iOS note: Apple forbids reading SMS entirely, so SMS capture is Android-only.
> The shell itself would still work on iOS for everything else.

## Do I have to rebuild for every change?

**No.** The shell loads the live URL, so **all web/UI/backend changes ship with a
normal Vercel deploy — no rebuild.** You only rebuild the APK when you change
**native** code (the receiver) or Capacitor config. And even the SMS URL/secret
are editable **in-app** (the "Lattice SMS" screen), so those never need a rebuild
either. In practice: build once, then rarely again.

## What's in the repo

- `capacitor.config.ts` — points the shell at `https://lattice-pink.vercel.app`.
- `native/www/index.html` — offline fallback splash (Capacitor requires a webDir).
- `native/android-sms/` — the native pieces (plain **Java**, so they compile in
  the stock Capacitor Android project):
  - `SmsForwardReceiver.java` — background SMS → webhook forwarder.
  - `SettingsActivity.java` + `activity_lattice_settings.xml` — in-app screen to
    set the URL/secret and send a test, without rebuilding.
  - `SmsConfig.java` — reads that config (SharedPreferences → resource fallback).
  - `AndroidManifest.snippet.xml` — permissions + components (reference).
  - `lattice.xml` — default URL/secret string resources (reference).
- `scripts/native-patch.mjs` — drops all of the above into the generated
  `android/` project and patches the manifest (used by both the manual flow and CI).
- `.github/workflows/android-apk.yml` — builds + signs the APK in the cloud.

The generated `android/` project is **gitignored** — it's produced from the
official Capacitor template on demand, then patched deterministically.

---

## Option A — build in the cloud (no Android Studio)

Push a tag (or click **Actions → Build Android APK → Run workflow**) and download
the signed APK from the run's artifacts (or the GitHub Release for a tag).

**One-time secrets** (repo → Settings → Secrets and variables → Actions):

| Secret | What |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Your signing keystore, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias |
| `ANDROID_KEY_PASSWORD` | Key password |
| `LATTICE_INGEST_URL` | *(optional)* bakes a default webhook URL |
| `LATTICE_INGEST_SECRET` | *(optional)* bakes a default secret |

The `LATTICE_*` ones are optional because you can set them in-app. Generate a
keystore once and encode it:

```bash
keytool -genkey -v -keystore lattice.keystore -alias lattice \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 lattice.keystore   # paste into ANDROID_KEYSTORE_BASE64
```

Then: **Actions → Build Android APK → Run workflow**, wait, download
`lattice-apk`, and sideload it (allow "install unknown apps"). Each CI run
auto-bumps `versionCode` from the run number (and `versionName` from the tag),
so every APK installs as a clean upgrade over the last — no version clashes.

## Option B — build locally

Prereqs: **Node 20+**, **Android Studio** (bundled JDK + SDK), a device/emulator.

```bash
npm install
npm run cap:add                 # generates android/
node scripts/native-patch.mjs   # injects the SMS pieces + manifest
npm run cap:sync                # copies web assets + config
npm run cap:open                # opens Android Studio → Run, or Build → APK
```

---

## First launch

Android will ask to allow **SMS** — grant it, and disable battery optimization
for Lattice so the receiver isn't killed. Open the **"Lattice SMS"** icon, set
your webhook URL + secret (the `SMS_INGEST_SECRET` / `CRON_SECRET` from Vercel),
tap **Send test**, and confirm it says `Server responded 200`. Done — pay for
something and the expense logs itself.

## SMS not being recorded?

The `Send test` button works over plain HTTP, so a `200` there does NOT prove SMS
capture works. Real incoming SMS needs two things Android controls:

1. **RECEIVE_SMS runtime permission** — the app now prompts on the "Lattice SMS"
   screen and shows a green "✓ SMS permission granted" status. If it's not
   granted, incoming SMS never reaches the receiver. Grant it there, or via
   Settings → Apps → Lattice → Permissions → SMS → Allow.
2. **Auto-start / no battery restriction** — Xiaomi (MIUI), Realme/Oppo/OnePlus
   (ColorOS), Vivo, Samsung etc. kill background broadcast receivers unless the
   app is allowed to **Auto-start** and set to **Unrestricted** battery. Enable
   both for Lattice.

## How auth works

The receiver sends `POST /api/sms` with `Authorization: Bearer <secret>` and
`{"text": "<sms body>"}`. The server matches the secret against
`SMS_INGEST_SECRET` (falling back to `CRON_SECRET`), dedupes, parses amount +
merchant, categorizes, and writes the "worth it?" thought.

## Privacy

The receiver pre-filters on the phone: only texts with money words (`debited`,
`upi`, `₹`, `txn`, …) are sent; everything else never leaves the device. The
server further ignores anything that isn't a debit transaction.
