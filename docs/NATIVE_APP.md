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

## What's in the repo

- `capacitor.config.ts` — points the shell at `https://lattice-pink.vercel.app`.
- `native/www/index.html` — offline fallback splash (Capacitor requires a webDir).
- `native/android-sms/` — the native pieces you drop into the generated project:
  - `SmsForwardReceiver.kt` — the background SMS → webhook forwarder.
  - `AndroidManifest.snippet.xml` — permissions + receiver to merge in.
  - `lattice.xml` — your webhook URL + secret (string resources).

The generated `android/` Gradle project is **not** committed — you generate it
locally with Android Studio (below). Add `/android` to `.gitignore` if you don't
want it tracked, or commit it if you prefer.

## One-time setup

Prereqs: **Node 20+**, **Android Studio** (bundled JDK + SDK), a device or
emulator.

```bash
npm install
npm run cap:add        # generates the android/ project (needs Android SDK)
```

### Wire up the SMS receiver

1. Copy the Kotlin file into the app package:
   `native/android-sms/SmsForwardReceiver.kt`
   → `android/app/src/main/java/app/lattice/mobile/SmsForwardReceiver.kt`

2. Copy the config resource:
   `native/android-sms/lattice.xml`
   → `android/app/src/main/res/values/lattice.xml`
   Then edit it: set your webhook URL and the **`SMS_INGEST_SECRET`** (or
   `CRON_SECRET`) you configured in Vercel. Keep this file private.

3. Merge `native/android-sms/AndroidManifest.snippet.xml` into
   `android/app/src/main/AndroidManifest.xml` (the `RECEIVE_SMS` / `INTERNET`
   permissions and the `<receiver>` block).

### Build & install

```bash
npm run cap:sync       # copies web assets + config into android/
npm run cap:open       # opens Android Studio
```

In Android Studio: **Run** to install on your phone, or **Build → Build APK** to
get a sideloadable `.apk`. On first launch, Android will ask to allow **SMS**
permission — grant it (and disable battery optimization for Lattice so the
receiver isn't killed).

That's it — pay for something, the bank SMS arrives, and the expense shows up in
Lattice on its own.

## How auth works

The receiver sends `POST /api/sms` with `Authorization: Bearer <secret>` and a
JSON body `{"text": "<sms body>"}`. The server matches the secret against
`SMS_INGEST_SECRET` (falling back to `CRON_SECRET`), dedupes, parses the amount
+ merchant, categorizes it, and writes the "worth it?" thought. If neither env
var is set, the endpoint is open (fine for single-user, but set a secret).

## Privacy

The receiver pre-filters on the phone: only texts containing money words
(`debited`, `upi`, `₹`, `txn`, …) are sent; everything else never leaves the
device. The server further ignores anything that isn't a debit transaction.

## Updating

Because the shell loads the live URL, **web changes ship instantly** — deploy to
Vercel as usual, no rebuild. You only rebuild the APK when you change native code
(the receiver) or Capacitor config.
