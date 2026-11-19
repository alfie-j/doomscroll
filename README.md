# Mindscroll

A personal, TikTok-style learning feed for Android. Swipe up for the next idea, swipe right to go deeper, double-tap to like. Built with Expo + React Native.

## What's in it

- **2,004 cards**: about 1,000 course cards across six courses running from first-year undergrad to masters level (Calculus 1, 2, 3/MVC with linear algebra, complex analysis, analysis and topology; Physics 1 mechanics, 2 E&M, 3 waves/thermo/relativity/quantum with QFT, GR, condensed matter and quantum information), including exam-practice drills and common-mistake cards. Plus about 1,000 breadth cards: philosophy, literature, history, psychology, statistics, computing, economics, biology, chemistry, art and music, language and Earth science.
- **Nine card formats**: hook, explainer, story, real-life, quiz, predict-with-a-bet, myth or fact, meme, interactive graph (derivative, Riemann sums, Taylor series, compound interest, birthday paradox).
- **The engine** (`app/src/engine/engine.ts`): Thompson-sampling bandit over subject × format, rewarded by dwell time, likes, saves, deeper swipes and answers; 60/40 course vs curiosity (ramps to 85% course in the 14 days before an exam you set); a banger every 4–6 cards; best card served when you look like leaving; chain cliffhangers held back 2–4 cards; spaced repetition at 1/3/7/16/35/90 days.
- **Reward loops**: combo with tiers (×1.5 / ×2 / ×3 XP), random crits, mystery drops on a variable schedule (XP, jackpot, streak freeze, combo shield), streaks with freezes, levels and subject titles, daily goal with a bonus round, curiosity-hook notifications.
- **Me screen**: exam readiness per course, exam dates, weekly stats (cards per session, skip rate per format, quiz accuracy), what the bandit thinks hooks you, settings.
- Data stays on the phone in SQLite (`app/src/data/store.ts`), behind one small interface so sync can be added later.

Why each mechanic is there: [docs/RESEARCH.md](docs/RESEARCH.md).

## Run it

```bash
cd app && npm install
```

Fastest way onto your phone: install **Expo Go** from the Play Store, then

```bash
npx expo start
```

and scan the QR code.

Installable APK (free Expo account, builds in the cloud):

```bash
npx eas-cli@latest build -p android --profile preview
```

## Develop

```bash
npx tsc --noEmit          # typecheck
npx tsx scripts/simulate.ts   # validate every card, then simulate 160 swipes through the engine
node scripts/make-sounds.mjs  # regenerate the sound set
```

Most cards live in `app/content-src/*.cards`, a compact text format documented at the top of `app/scripts/compile-cards.ts`. After editing, run `npx tsx scripts/compile-cards.ts` to rebuild `src/content/generated.json`; it rejects malformed cards. The first 204 cards are TypeScript in `app/src/content/` (`maths.ts`, `physics.ts`, `breadth.ts`).

`design/style-tile.html` is the original style tile from step 1.
