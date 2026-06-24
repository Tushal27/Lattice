# Auto-capture spending from payment SMS (Android)

The goal: every time you pay, the bank/UPI/GPay **SMS** is forwarded to Lattice,
which **auto-logs the expense, categorizes it, and adds a grounded "worth it?"
thought** — no opening the app, no speaking.

There's no GPay transactions API, and a web app can't read SMS directly. So your
phone forwards the SMS to Lattice's webhook. This takes ~5 minutes to set up once.

## 1. Set a secret on the server

Add an env var on your Vercel deployment:

```
SMS_INGEST_SECRET = <any long random string>
```

(If you skip it, the endpoint is open — fine for a private single-user app, but a
secret is recommended.)

The webhook is:

```
POST https://your-app.vercel.app/api/sms
Header:  Authorization: Bearer <SMS_INGEST_SECRET>
Body:    {"text":"<the full SMS body>"}
```

Quick test from your computer:

```bash
curl -X POST https://your-app.vercel.app/api/sms \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"text":"Rs 450 debited from A/c XX1234 to ZOMATO via UPI. Ref 123."}'
# → {"ok":true,"created":"…","amount":450,"category":"Food","thought":"…"}
```

## 2. Forward payment SMS from your phone

Use any of these (all free). Filter to your bank/UPI senders so only payment
texts are forwarded.

### Option A — MacroDroid (easiest)
1. Install MacroDroid → New Macro.
2. **Trigger:** "SMS Received" → from your bank senders (e.g. contains `debited`,
   `UPI`, or sender like `*BANK*`, `*UPI*`).
3. **Action:** "HTTP Request" → POST →
   - URL: `https://your-app.vercel.app/api/sms?secret=YOUR_SECRET`
   - Content type: `application/json`
   - Body: `{"text":"[sms_message]"}`  (use MacroDroid's `[sms_message]` variable)
4. Save. Done.

### Option B — Tasker
1. Profile → Event → Phone → **Received Text**. (Optional: Sender filter for bank.)
2. Task → Net → **HTTP Request**:
   - Method: POST
   - URL: `https://your-app.vercel.app/api/sms?secret=YOUR_SECRET`
   - Headers: `Content-Type:application/json`
   - Body: `{"text":"%SMSRB"}`  (`%SMSRB` = the SMS body)

### Option C — an "SMS Forwarder" app with webhook support
Several apps (e.g. "SMS Forwarder", "SMS to URL Forwarder") let you POST matching
SMS to a URL. Point them at the webhook above with a JSON body `{"text": "{{message}}"}`
(use the app's message placeholder), filtered to bank senders.

## 3. What happens

For each forwarded SMS, Lattice:
- ignores non-payments (OTPs, promos, credits),
- extracts the amount + merchant, **auto-categorizes** it,
- logs it as an expense (shows in **Money → All spends**),
- writes a short **"worth it?" thought** grounded in your recent spending and
  values, shown on the expense and pushed to your phone (if notifications are on).

Duplicates are ignored, so re-sends are safe.
