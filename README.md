<div align="center">

# Calobit

**Track calories, macros, and movement — offline or AI-powered, your choice.**

[![Live](https://img.shields.io/badge/live-Calobit.vercel.app-2E7D32?style=flat-square)](https://Calobit.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=flat-square&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![License: Attribution-NonCommercial](https://img.shields.io/badge/License-Attribution--NonCommercial-orange.svg?style=flat-square)](./LICENSE)

[Live Demo](https://Calobit.vercel.app) · [Report a Bug](#) · [Request a Feature](#)

</div>

<br>

## About

Calobit is a calorie and macro tracker that adapts to how you actually eat and train. Log meals with a local offline database, AI photo/text recognition, or barcode scanning for local products AI and databases don't cover — plus built-in gym and cardio tracking, all in one app.

<br>

## Features

| | |
|---|---|
| 🥗 **Full Macro Tracking** | Calories, protein, carbs, and fats — not just a calorie count |
| 📴 **Offline Local Database** | Log meals fully offline with a free, local, on-device database |
| 🤖 **AI Logging** | Snap a photo or describe a meal in text — AI handles the breakdown |
| 📷 **Barcode Scanning** | Scan local/regional products AI and the database don't recognize |
| 🏋️ **Gym Routine Tracking** | Log and follow workout routines built into the app |
| 🏃 **Walking/Running Tracker** | Track cardio sessions alongside your nutrition |

<br>

## Tech Stack

- **Framework:** Next.js
- **Mobile:** Capacitor (Android)
- **Storage:** Local on-device database (no backend required for core features)
- **Hosting:** Vercel

<br>

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Android Studio (if building the mobile app)
- An AI provider API key (only needed if you want AI-powered logging — the local database tier works fully offline without one)

### Installation

```bash
# Clone the repo
git clone https://github.com/basitadnan/calobit.git
cd calobit

# Install dependencies
npm install

# Set up environment variables (only needed for AI features)
cp .env.example .env.local
# Fill in your AI provider key
```

### Running the web app

```bash
npm run dev
```

Visit `http://localhost:3000`.

### Building the Android app

```bash
npx cap sync android
npx cap open android
```

Then build and run from Android Studio.

<br>

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a pull request.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to your branch and open a PR

<br>

## License

Distributed under an Attribution-NonCommercial license. You're free to use, modify, and share this code — with credit to the original author — but it may not be sold or used commercially without permission. See [`LICENSE`](./LICENSE) for full terms.

<br>

<div align="center">

Built by [Abdul Basit](https://github.com/basitadnan)

</div>