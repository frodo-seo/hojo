# Hojo

[🇰🇷 한국어](README.md) · 🇬🇧 English

> No manual entry. Just a screenshot.
> Your data on your device. AI with your own API key.

**Hojo** is a server-less, **image-only ledger and portfolio tracker**. Every record — expense, income, asset — starts from a screenshot. Upload a receipt, a payment screen, a pay stub, or a brokerage / exchange view, and OCR + Claude read it, classify it, and parse it. Ledgers live in the on-device IndexedDB; AI / OCR run through keys you issue yourself.

---

## Principles

- **Image-only input** — You don't type amounts, categories, or tickers. Upload a screenshot and OCR → classify → parse runs end-to-end; at review time you just correct what needs fixing.
- **BYOK (Bring Your Own Key)** — Anthropic and Datalab keys are issued from your own accounts and stored locally. No dependence on a provider's infrastructure.
- **Local-first** — Transactions, assets, reports, and settings live only in the device's IndexedDB. No cloud sync, no signup.
- **Monthly / yearly reports** — Claude reads accumulated transaction and asset data and writes a structured summary.
- **Open source (MIT)** — Fully public code. Fork, modify, and redistribute freely.

---

## How it works

```
[screenshot + optional hint]
  └─ Chandra OCR (Datalab)         → markdown text
       └─ Classifier Agent (Sonnet) → ledger / asset_trade
            └─ unified parser (Sonnet) → per-line type · currency · category
                 └─ user review     → IndexedDB
```

What one screenshot covers:

- Receipts, card approvals, delivery apps → expense
- P2P incoming transfers, refunds, dividends → income
- Telecom, rent, subscriptions → recurring expense
- Pay stubs, recurring inbound transfers → recurring income
- **Mixed ledger in one image** — when expenses, income, and recurring items are interleaved (e.g. a card notification list), each line is classified independently
- **Per-line currency detection** — Korean card overseas charges that show both KRW and USD are parsed as the original foreign-currency amount (USD / EUR / JPY / GBP) and auto-converted via live FX
- Brokerage / exchange / metals screens → asset holdings or trades (multi-ticker screenshots are parsed in one pass)
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

- **Single screenshot entry point** — receipts, payment screens, pay stubs, bills, brokerage / exchange views all handled by one pipeline
- **Mixed-ledger awareness** — expenses, income, and recurring items that appear side-by-side in one image are separated line by line
- **Multi-currency** — KRW / USD / EUR / JPY / GBP. Foreign amounts are auto-converted via live FX; per-line currency means a notification list with mixed currencies is handled correctly
- **Multi-holding asset OCR** — one brokerage screenshot with several tickers is parsed in a single pass
- Asset portfolio: stocks / ETFs, crypto, commodities (gold / silver / platinum) with live quotes, average cost, market value, and P/L
- Net-worth aggregation in a base currency plus a pie chart
- Monthly budget and usage tracking
- Daily / monthly / yearly AI report (Claude) — includes a morning daily briefing
- Multilingual (한국어 / English) — AI report language follows the UI
- 8 AM daily briefing notification
- CSV export

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
       └─ CapacitorHttp
            ├─ Datalab Chandra OCR
            ├─ Anthropic (Sonnet — classification, parsing, and reports)
            ├─ Yahoo Finance · Stooq (stocks, commodities quotes)
            ├─ CoinGecko (crypto quotes)
            └─ Frankfurter (FX)
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
