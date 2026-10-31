# OpenTradeLog

> An open-source, local-first futures trading journal and prop trader cockpit. 100% offline, zero telemetry, portable SQLite vault.

---

## 📸 Preview

| Dashboard & Guardrails | Daily Journal & Routines |
| :---: | :---: |
| ![Dashboard](./docs/screenshots/dashboard.png) | ![Journal](./docs/screenshots/journal.png) |

| Trade Log & Round-Trips | Performance & Analytics |
| :---: | :---: |
| ![Trades](./docs/screenshots/trades.png) | ![Analytics](./docs/screenshots/analytics.png) |

---

## ✨ Features

- **Live Prop-Firm Guardrails**: Real-time meters for trailing max drawdown, daily loss limit, profit target, and consistency rules (Topstep & custom profiles).
- **Auto Round-Trip Trades**: Ingest broker/TradingView CSV fills with automatic position grouping (handles scale-in/out, position flips).
- **Local-First "Vault"**: Your data lives in a portable folder you own (`journal.sqlite` + mirrored CSV/Markdown). 100% offline, zero cloud lock-in.
- **Analytics & Psychology**: Win rate, expectancy, profit factor, R-multiples, and daily pre/post-market game plans.
- **Pro Terminal Design**: Dark-first, keyboard-friendly, tabular layout.

---

## 🛠️ Tech Stack

- **Desktop**: Electron 39
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts
- **Database & ORM**: SQLite (`better-sqlite3`), Drizzle ORM

---

## 🚀 Quickstart

```bash
# Install dependencies
pnpm install

# Start development app
pnpm dev

# Run tests
pnpm test

# Build production bundle
pnpm build
```

---

## 📄 License

[MIT](./LICENSE) © OpenTradeLog contributors
