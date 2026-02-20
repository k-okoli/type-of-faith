# Type of Faith — MVP

A browser-based typing game that helps users practice touch-typing **while learning Scripture**.
It uses a **FastAPI backend proxy** to fetch verses from multiple sources and a front-end game (`practice.html`) to provide the interactive typing experience.

---

## Quick start

### Run the backend (FastAPI proxy)

1. Install dependencies (Python 3.8+):
   ```bash
   pip install -r requirements.txt
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
   - http://127.0.0.1:8000/health → returns server status, cache stats, and uptime

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
- **Seasonal events**: Christmas (Dec 1–25) and Easter/Holy Week themes with seasonal verses, banners, and visual accents
- **Session stats & history**: CSV export
- **Avatar selection**: 7 biblical character avatars with unlock system
- **Achievement tracking**: Unlock avatars through races, WPM milestones, lessons
- **Race track progress bar**: Visual typing progress

### Lessons Page (lessons.html)
- **Touch-typing lessons**: 10 progressive lessons from home row to full verses
- **Interactive keyboard map**: Highlights keys as you type
- **Hand diagrams**: Image-based hands with 3 skin tones
- **Per-finger highlighting**: Shows which finger to use
- **Accuracy tracking**: 95% minimum to advance
- **Retry system**: Clear feedback when accuracy not met

### Quiz Page (quiz.html)
- **Solo / Multiplayer toggle**: Switch between solo and multiplayer modes
- **Solo Mode**:
  - **Quiz**: Guess the verse reference from text, multiple choice (4 options)
  - **Study**: Browse verses before quizzing
  - **Streak tracking**: Track consecutive correct answers
- **Multiplayer Mode**:
  - **Real-time quiz rounds**: First to pick the correct verse reference wins the point
  - **Lobby system**: Create or join lobbies with 6-character codes
  - **Configurable rounds**: 5, 10, or 15 rounds per match
  - **Live scoreboard**: See all players' scores and lock-out status
  - **Play Again**: Rematch support after quiz ends

### Race Page (race.html)
- **Solo / Multiplayer toggle**: Switch between solo and multiplayer modes
- **Solo Mode**:
  - **AI opponents**: Race against 1-3 AI racers
  - **Three AI modes**:
    - **Fixed**: Constant speeds (20, 40, 60 WPM)
    - **Personality**: Character-specific typing patterns
    - **Adaptive**: Adjusts to your recent performance
  - **Countdown with audio**: 3, 2, 1, GO!
  - **Results panel**: Final standings with times and WPM
- **Multiplayer Mode**:
  - **Real-time racing**: Race against other players via WebSocket
  - **Lobby system**: Create or join lobbies with 6-character codes
  - **Live progress sync**: See all players' progress in real-time
  - **Results & standings**: Final positions with WPM for each player

### Audio & Feedback
- **Sound effects**: Correct/error keystrokes, completion, countdown
- **Mute toggle**: In navigation bar
- **Corrected highlighting**: Yellow background for fixed mistakes
- **Celebration animations**: Confetti, trophy popups, milestone toasts
- **Achievement toasts**: Slide-in notifications for avatar unlocks

### Keyboard shortcuts
- `Ctrl+Enter` → Finish attempt
- `Ctrl+P` → Peek (Blind Faith mode)
- `Ctrl+R` → Restart verse
- `Ctrl+M` → New verse

### Backend API (server.py)
- **Async requests**: Non-blocking verse fetching with httpx
- **File-based caching**: 24-hour TTL, max 5000 entries, persists across restarts
- **Rate limiting**: 60 requests/minute per IP (slowapi)
- **Retry logic**: Exponential backoff (3 attempts) for transient failures
- **Structured logging**: Request/cache activity logged with timestamps
- **Health endpoint**: Returns uptime, cache stats, supported versions

---

## File layout

```
.
├─ server.py              # FastAPI proxy for verse fetching
├─ requirements.txt       # Python dependencies
├─ index.html             # Redirect to practice.html (for GitHub Pages)
├─ practice.html          # Practice page — main typing game
├─ lessons.html           # Touch-typing lessons with keyboard map
├─ quiz.html              # Verse identification quiz
├─ race.html              # Race mode — compete against AI
├─ lobby.html             # Legacy multiplayer page (redirects to race/quiz)
├─ shared/
│  ├─ nav.js              # Navigation bar injection
│  ├─ nav.css             # Navigation styles
│  ├─ theme.js            # Theme switching (auto/light/dark)
│  ├─ data.js             # Verse categories and references
│  ├─ audio.js            # Sound effects (Web Audio API)
│  ├─ achievements.js     # Avatar unlocking & achievement tracking
│  ├─ leaderboard.js      # Auth & leaderboard API client
│  └─ seasons.js          # Seasonal theming (Christmas, Easter/Holy Week)
├─ assets/
│  ├─ avatars/            # Biblical character PNGs (2D & 3D)
│  └─ hands/              # Hand diagram images (3 skin tones)
├─ tests/                 # Unit tests (pytest + JS)
├─ docs/                  # Architecture documentation
├─ .cache/                # Verse cache (auto-created, gitignored)
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
- **CORS errors**: `server.py` has CORS enabled for localhost. For production, add your domain to `ALLOWED_ORIGINS`.
- **Nothing loads**: Run from a local server, not `file://`.
- **Rate limit errors (429)**: Wait a minute or reduce request frequency.
- **Clear cache**: Visit `http://127.0.0.1:8000/cache/clear` to reset cached verses.

---

## Roadmap

- [ ] 3D avatar toggle (assets ready)
- [x] Avatar unlocking through achievements
- [x] Multiplayer lobbies / real-time racing & quiz
- [x] Global leaderboard for daily challenges
- [x] Celebration animations (confetti, trophies, toasts)
- [ ] More Bible translations (NIV, CSB, NLT)
- [x] Seasonal events — Christmas & Easter/Holy Week (banners, themed verses, visual accents)
- [ ] More seasonal events (Lent, Pentecost)

---

## License & attribution

- **KJV**: public domain.
- **WEB**: public domain.
- **FBV**: © Dr. Jonathan Gallagher, Creative Commons Attribution-ShareAlike 4.0.
- Other translations: check publisher's license.

---
