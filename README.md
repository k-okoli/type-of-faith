# Type of Faith — MVP

A browser-based typing game that helps users practice touch-typing **while learning Scripture**.
It uses a **FastAPI backend proxy** to fetch verses from multiple sources and a front-end game (`practice.html`) to provide the interactive typing experience.

---

## Quick start

### Run the backend (FastAPI proxy)

1. Install dependencies (Python 3.8+):
   ```bash
   pip install fastapi uvicorn requests dotenv
   ```

2. Set your API keys (in PowerShell on Windows):
   ```powershell
   $env:API_BIBLE_KEY="your_api_bible_key_here"
   ```

   OR create a file called .env in your project folder. This keeps secret keys local and private.
   ```bash
   API_BIBLE_KEY="your_api_bible_key_here"
   ```

3. Start the server:
   ```bash
   uvicorn server:app --reload --port 8000
   ```

4. Visit the health check:
   - http://127.0.0.1:8000/health → should return `{"ok": true}`

### Run the frontend (game UI)

- Simply open `practice.html` in a browser.
  If your browser blocks `file://` fetch requests, run a tiny static server:
  - Python: `python -m http.server 8080` → http://localhost:8080/practice.html
  - VS Code: Live Server extension

---

## Features

### Practice Page (practice.html)
- **Verse fetching** via proxy (KJV, WEB, FBV, ESV)
- **Category & length filters**: 19 categories, Short/Medium/Long
- **Blind Faith mode**: Verse hidden after preview, type from memory
- **Typing feedback**: Green (correct), red (error), yellow (corrected)
- **Live metrics**: WPM, accuracy, time
- **Daily Challenge**: Date-seeded verse of the day with best score tracking
- **Session stats & history**: CSV export
- **Avatar selection**: 7 biblical character avatars
- **Race track progress bar**: Visual typing progress

### Lessons Page (lessons.html)
- **Touch-typing lessons**: 10 progressive lessons from home row to full verses
- **Interactive keyboard map**: Highlights keys as you type
- **Hand diagrams**: Image-based hands with 3 skin tones
- **Per-finger highlighting**: Shows which finger to use
- **Accuracy tracking**: 95% minimum to advance
- **Retry system**: Clear feedback when accuracy not met

### Quiz Page (quiz.html)
- **Verse identification**: Guess the reference from verse text
- **Multiple choice**: 4 options per question
- **Study Mode**: Browse verses before quizzing
- **Streak tracking**: Track consecutive correct answers

### Race Page (race.html)
- **AI opponents**: Race against 1-3 AI racers
- **Three AI modes**:
  - **Fixed**: Constant speeds (20, 40, 60 WPM)
  - **Personality**: Character-specific typing patterns
  - **Adaptive**: Adjusts to your recent performance
- **Countdown with audio**: 3, 2, 1, GO!
- **Results panel**: Final standings with times and WPM

### Audio & Feedback
- **Sound effects**: Correct/error keystrokes, completion, countdown
- **Mute toggle**: In navigation bar
- **Corrected highlighting**: Yellow background for fixed mistakes

### Keyboard shortcuts
- `Ctrl+Enter` → Finish attempt
- `Ctrl+P` → Peek (Blind Faith mode)
- `Ctrl+R` → Restart verse
- `Ctrl+M` → New verse

---

## File layout

```
.
├─ server.py              # FastAPI proxy for verse fetching
├─ practice.html          # Practice page — main typing game
├─ lessons.html           # Touch-typing lessons with keyboard map
├─ quiz.html              # Verse identification quiz
├─ race.html              # Race mode — compete against AI
├─ shared/
│  ├─ nav.js              # Navigation bar injection
│  ├─ nav.css             # Navigation styles
│  ├─ theme.js            # Theme switching (auto/light/dark)
│  ├─ data.js             # Verse categories and references
│  └─ audio.js            # Sound effects (Web Audio API)
├─ assets/
│  ├─ avatars/            # Biblical character PNGs (2D & 3D)
│  └─ hands/              # Hand diagram images (3 skin tones)
├─ todo.md                # Project task tracker
└─ README.md              # Project documentation
```

---

## Configuration

Open `practice.html` and look for these constants:
- **Timers**
  - `DEFAULT_PREVIEW_SECONDS = 10` (Blind Faith preview)
  - `DEFAULT_PEEK_SECONDS = 5` (Blind Faith peek)
- **Length thresholds**
  - `LENGTH_THRESHOLDS.shortMax = 110`
  - `LENGTH_THRESHOLDS.mediumMax = 230`

---

## Adding more translations

Extend `VERSION_MAP` in `server.py`:
```python
VERSION_MAP = {
    "KJV": {"provider": "bibleapi", "id": None},
    "WEB": {"provider": "bibleapi", "id": "web"},
    "FBV": {"provider": "apibible", "id": "65eec8e0b60e656b-01"},
}
```
Restart the server and add the version to the `<select>` dropdown.

---

## Troubleshooting

- **FBV/api.bible returns 500**: Ensure `API_BIBLE_KEY` is set and valid.
- **CORS errors**: `server.py` has CORS enabled by default.
- **Nothing loads**: Run from a local server, not `file://`.

---

## Roadmap

- [ ] 3D avatar toggle (assets ready)
- [ ] Avatar unlocking through achievements
- [ ] Multiplayer lobbies / ghost races
- [ ] Global leaderboard for daily challenges
- [ ] More Bible translations (NIV, CSB, NLT)
- [ ] Seasonal events (Christmas, Easter, Pentecost)

---

## License & attribution

- **KJV**: public domain.
- **WEB**: public domain.
- **FBV**: © Dr. Jonathan Gallagher, Creative Commons Attribution-ShareAlike 4.0.
- Other translations: check publisher's license.

---
