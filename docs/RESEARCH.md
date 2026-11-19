# What keeps people scrolling, and what Mindscroll does with it

Research notes for the addiction engine. Each mechanic says where it comes from and how the app uses it. "Built" means it ships in the current app; "Next" means it's planned.

## 1. What the platforms actually optimise

**TikTok optimises for two numbers: retention (do you come back) and time spent.** An internal TikTok explainer leaked to the New York Times in 2021 ("TikTok Algo 101") describes a score built from predicted likes, comments, playtime and whether a video gets played at all. TikTok confirmed the document was real. ([Gizmodo](https://gizmodo.com/leaked-tiktok-doc-reveals-its-obvious-secret-to-an-addi-1848166901), [Inverse](https://inverse.com/input/culture/tiktok-internal-docs-reveal-just-how-simple-it-is-to-keep-you-addicted))

**Watch time and rewatches are the strongest signal.** The Wall Street Journal ran 100+ bot accounts with secret interests. TikTok worked out each bot's interests from how long it lingered and what it rewatched, often in under two hours, then narrowed into rabbit holes. ([Tubefilter](https://tubefilter.com/2021/07/21/tiktok-recommendation-algorithm-wall-street-journal-guillaume-chaslot/), [5Rights summary](https://5rightsfoundation.com/resource/tiktoks-secretive-algorithm-unpacked-by-the-wall-street-journal/))

**The model updates in near real time.** ByteDance's Monolith paper describes training on a live stream of interactions instead of nightly batches, so the feed reacts within a session. ([arXiv 2209.07663](https://arxiv.org/pdf/2209.07663))

**Instagram ranks Reels on watch time, likes per reach and sends per reach** (Adam Mosseri, Jan 2025). Rates matter more than raw counts. ([Social Media Today](https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/))

| Mechanic | Mindscroll | Status |
|---|---|---|
| Dwell time is the main reward, fast skips count against | Every card exit scores dwell against the card's expected read time; under 1.5 s is a skip | Built |
| Rewatch = strong positive | Swiping back to a card adds reward to it | Built |
| Real-time learning | The bandit updates on every card, so the feed changes within a session | Built |
| "Sends" = strongest intent | Save and double-tap like are weighted above dwell | Built |

## 2. Feed mechanics

**No natural stopping points.** Researchers single out infinite scroll and autoplay as the features that override self-control, because removing end-points puts people on autopilot. A 2026 CHI study found that adding friction (no autoplay, harder scrolling) reduced compulsive use, which confirms that low friction is the engine. ([The Star](https://www.thestar.com.my/news/nation/2025/07/20/hooked-on-autoplay-infinite-scrolling-and-dopamine-hits))

**Variable rewards.** The feed works like a slot machine: you don't know if the next swipe pays out, so you keep pulling (Ofir Turel, University of Melbourne, in the same coverage). Skinner's variable-ratio schedule is the most extinction-resistant reinforcement schedule known.

| Mechanic | Mindscroll | Status |
|---|---|---|
| Opens straight into content | App launches into a full-screen card; no home screen | Built |
| One gesture | Swipe up = next. Everything else is optional | Built |
| Infinite feed | The engine always has a next card (new, review or recycled) | Built |
| Hide time cues | Status bar and clock hidden while in the feed | Built |
| Instant | The next 2 cards are rendered before you reach them; all content is on the phone | Built |
| Variable rewards | Mystery drops every 6–11 engaged cards with skewed random prizes; random XP crits (×2, ×3) on correct answers; legendary cards | Built |
| Format roulette | Back-to-back repeats of a format are heavily penalised; 9 formats in rotation | Built |

## 3. The hook inside each card

**Hooks win or lose in the first ~3 seconds.** Creator guides agree on the pattern: pattern interrupt + value promise + open loop. Marketing blogs, not peer-reviewed, but consistent. ([dev.to hook engineering](https://dev.to/bulkdl/hook-engineering-the-science-of-the-first-3-seconds-in-short-form-video-2026-2jp9), [CapCut](https://www.capcut.com/create/short-form-video-hooks-first-3-second-patterns))

**Curiosity is an information gap** (Loewenstein). A small bite of knowledge makes you hungrier. Kang et al. (2009) showed curiosity activates reward circuitry and improves memory for the answer, peaking when people are moderately unsure. ([Kang et al., Psychological Science](https://www.cmu.edu/dietrich/sds/docs/loewenstein/WickCandleLearning.pdf))

**Unfinished things nag** (Zeigarnik effect): interrupted tasks are remembered and pull you back.

| Mechanic | Mindscroll | Status |
|---|---|---|
| Hook in the first line | Every card leads with its most surprising claim in huge type | Built |
| Open loop at the end | Every card ends on a cliffhanger line | Built |
| Cliffhanger chains | Chain part N+1 is held back 2–4 cards, with "Part 2 incoming" in the HUD, so the loop stays open | Built |
| Guess before the answer | Predict cards and myth/fact cards make you commit first; information-gap curiosity peaks at moderate confidence | Built |
| Rabbit hole on demand | Swipe right on any card with depth to go deeper on that one idea | Built |

## 4. Progress and loss aversion (Duolingo)

**Streaks are Duolingo's biggest growth lever** per its retention PM; going from a 1-day to a 2-day streak is the biggest jump in retention, and streak freezes cut churn for at-risk users. ([Lenny's Newsletter](https://lennysnewsletter.com/p/behind-the-product-duolingo-streaks), [podcast summary](https://www.recall.it/summary/lennys-podcast/behind-the-product-duolingo-streaks-or-jackson-shuttleworth-group-pm-retention-team)) Figures come from interviews and secondary write-ups.

Other well-established effects used here:
- **Endowed progress** (Nunes & Drèze, 2006): people given a head start on a loyalty card finish it more often.
- **Goal gradient** (Kivetz et al., 2006): effort speeds up as the goal gets close.
- **Loss aversion** (Kahneman & Tversky): losses hurt about twice as much as equal gains, which is why a streak or combo you could lose is sticky.
- **Peak-end rule** (Kahneman): people judge an experience by its best moment and its end.

| Mechanic | Mindscroll | Status |
|---|---|---|
| Daily streak with freezes | Streak extends when the daily goal is hit; earn a freeze every 7 days (hold 2); drops can award freezes | Built |
| Endowed progress | Daily goal starts with the first card counted double | Built |
| Goal gradient | HUD goal bar; "3 to go" nudges near the end | Built |
| Combo you can lose | Combo grows on engaged cards and breaks on a fast skip; tiers at 5/10/20 boost XP ×1.5/×2/×3 and change the HUD | Built |
| Combo shield | Drops can award a shield that absorbs one break | Built |
| Levels and titles | XP levels with titles per subject ("Apprentice Physicist"); full-screen level-up | Built |
| Peak-end | The first card of every session is a banger; daily goal completion is a full-screen moment; leaving-risk triggers the best card | Built |
| Weekly leagues | Needs other people; it's a one-person app | Skipped |
| Fake social proof ("93% get this wrong") | Would be invented numbers, so not used | Skipped |

## 5. Learning science (so the addiction teaches)

- **Testing effect** (Roediger & Karpicke, 2006): self-testing beats re-reading a week later (61% vs 40%).
- **Spacing**: reviews spread over days beat cramming. Mindscroll resurfaces concepts at 1, 3, 7, 16 and 35 days.
- **Pretesting / generation**: guessing before learning improves retention even when the guess is wrong (Kornell, Hays & Bjork, 2009).
- **Hypercorrection** (Butterfield & Metcalfe, 2001): confident errors get corrected best, which is why predict cards ask for a confidence bet.
- **Interleaving**: mixing topics beats blocks of one topic.

| Mechanic | Mindscroll | Status |
|---|---|---|
| Spaced review cards | "Remember this?" recall cards with self-grade; Leitner boxes | Built |
| Confidence bets | Predict cards bet 10/25/50 XP; high-confidence misses get a "this is the one you'll remember" note | Built |
| Interleaving | A third card in a row from one subject is heavily penalised | Built |

## 6. Algorithm

Thompson sampling over (subject × format) arms, Beta priors, fractional rewards from dwell, deeper swipes, likes, saves and answers. On top:
- 15% wildcard picks from outside your top arms, so it keeps finding new obsessions.
- Interest drift: a subject you binge gets a session boost that decays over ~10 cards.
- Pacing: a banger (hand-rated hook strength 4–5) every 4–6 cards; never two weak cards in a row.
- Exit risk: two fast skips in a row or falling dwell = serve the strongest card left.

## 7. Notifications

TikTok-style pull-back without "come back!" copy: one daily local notification at your usual time with the hook of a card you haven't seen, plus a streak-at-risk nudge at 21:00 if the goal isn't done. Built (Android asks permission on first launch).

## 8. Measure and tune (spec section 16)

The Stats screen shows cards per session, session length, days used this week, skip rate per format, quiz accuracy and the bandit's current favourite arms. Every event is logged to SQLite so ranking weights can be tuned weekly.
