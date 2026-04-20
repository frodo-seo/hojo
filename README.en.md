# Hojo

[🇰🇷 한국어](README.md) · 🇬🇧 English

> Your data on your device. AI with your own API key.
> An **open-source personal finance app** that logs expenses, income, and assets from a single screenshot.

**Hojo** is a server-less ledger and portfolio tracker. Instead of typing entries by hand, you upload a screenshot of a receipt, a payment notification, or a brokerage / exchange screen, and **AI reads it and classifies it automatically**. All ledgers live in the on-device database, and AI / OCR run through keys you issue yourself.

---

## Principles

- **Screenshot-first input** — Upload an image and OCR → classify → parse runs end-to-end. Missing fields can be filled in at the review step.
- **BYOK (Bring Your Own Key)** — Anthropic and Datalab keys are issued from your own accounts and stored locally. No dependence on a provider's infrastructure.
- **Local-first** — Transactions, assets, reports, and settings live only in the device's IndexedDB. No cloud sync, no signup.
- **Monthly / yearly reports** — Claude reads transaction and asset stats and writes a structured summary.
- **Open source (MIT)** — Fully public code. Fork, modify, and redistribute freely.

---

## How it works

```
[screenshot + optional hint]
  └─ Chandra OCR (Datalab)         → markdown text
       └─ Classifier Agent (Haiku) → expense / income / fixed_expense / fixed_income / asset_trade
            └─ domain parser        → structured fields
                 └─ user review     → IndexedDB
```

- Receipts, card approvals, delivery apps → expense
- P2P incoming transfers, refunds, dividends → income
- Telecom, rent, subscriptions → fixed expense
- Pay stubs, recurring inbound transfers → fixed income
- Brokerage, exchange, metals quote → asset holdings / trades
- Free-form hints like "only record the coffee as an expense" are honored by the parser.

---

## Install

### Android

1. Download the latest APK from [Releases](https://github.com/frodo-seo/hojo/releases)
2. Allow "Install unknown apps" (Settings → Security)
3. Open the APK → install

### First-run setup

After launching, go to **Settings → API Keys** and enter:

- **Anthropic API key** — for classification, parsing, and reports. Issue one at [console.anthropic.com](https://console.anthropic.com/).
- **Datalab API key** — for Chandra OCR. Issue one at [datalab.to](https://www.datalab.to/).

Keys are stored on-device only. They are never sent to a Hojo server (there is no Hojo server).

---

## Features

### Current

- **Single screenshot entry point** — receipts, payment notifications, pay stubs, bills, brokerage / exchange screens are all auto-recognized
- **Automatic payment notification parsing** — card / pay / bank notifications are intercepted and Haiku extracts amount, merchant, and category. Confirm from the detection card on Home
- Automatic five-way classification: expense, income, fixed expense, fixed income, asset
- Asset portfolio: stocks / ETFs, crypto, commodities (gold / silver / platinum) with live quotes
- Net-worth aggregation in a base currency plus a pie chart
- Monthly budget and usage tracking
- Monthly / yearly AI report (Claude)
- Multilingual (한국어 / English) — AI report language follows the UI
- 9 PM logging reminder
- CSV export

### Planned

- **Subscription detection** — group recurring payments into fixed expenses
- **Spike detection** — alert when spending exceeds the usual pattern
- **CSV import** — bulk upload of card statements
- **Gmail receipt integration** — auto-collect email receipts

---

## Build (for developers)

### Requirements

- Node.js 20+
- Android Studio (for the Android build)

### Web dev

```bash
git clone https://github.com/frodo-seo/hojo.git
cd hojo
npm install
npm run dev
```

### Android build

```bash
npm run mobile:sync     # sync dist → android/
npm run mobile:open     # open Android Studio
```

In Android Studio, use **Build → Generate Signed App Bundle / APK** to produce an APK / AAB.

---

## Architecture

```
[Android APK]
  └─ Capacitor (WebView)
       ├─ React 19 + TypeScript
       ├─ IndexedDB               (transactions, assets, reports, settings)
       ├─ Preferences             (API keys)
       ├─ NotificationListener    (payment notification capture, Kotlin)
       └─ CapacitorHttp
            ├─ Datalab Chandra OCR
            ├─ Anthropic (Haiku for classification / parsing, Sonnet for asset parsing / reports)
            ├─ Yahoo Finance (stocks, commodities quotes)
            └─ CoinGecko (crypto quotes)
```

- **No backend server.** The app calls external APIs directly.
- **Minimal transmission.** AI calls send only OCR text and transaction summaries; the raw image is discarded right after OCR.

---

## License

MIT License. Fork, modify, and redistribute as you wish.

---

## Disclaimer

- Hojo does not provide financial or investment advice. AI reports and quote data are for reference; consult a professional for actual financial decisions.
- Anthropic / Datalab API usage fees are the user's responsibility.
- The developer is not liable for any data loss or financial damage arising from use of the app.
