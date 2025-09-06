# Type of Faith — MVP

A browser-based typing game that helps users practice touch-typing **while learning Scripture**.  
It uses a **FastAPI backend proxy** to fetch verses from multiple sources and a front-end game (`index.html`) to provide the interactive typing experience.

---

## Quick start

### Run the backend (FastAPI proxy)

1. Install dependencies (Python 3.8+):
   ```bash
   pip install fastapi uvicorn requests
   ```

2. Set your API keys (in PowerShell on Windows):
   ```powershell
   $env:API_BIBLE_KEY="your_api_bible_key_here"
   ```

3. Start the server:
   ```bash
   uvicorn server:app --reload --port 8000
   ```

4. Visit the health check:
   - http://127.0.0.1:8000/health → should return `{"ok": true}`

### Run the frontend (game UI)

- Simply open `index.html` in a browser.  
  If your browser blocks `file://` fetch requests, run a tiny static server:
  - Python: `python -m http.server 8080` → http://localhost:8080/index.html
  - VS Code: Live Server extension

---

## Features

- **Verse fetching** via proxy:
  - **KJV** (public, via bible-api.com)
  - **WEB** (World English Bible, public, via bible-api.com)
  - **FBV** (Free Bible Version, via api.bible using API key)
  - (Support for more translations can be added by extending `VERSION_MAP` in `server.py`)

- **Category filter**: Love, Forgiveness, Faith, Wisdom, Hope, Courage, or All.
- **Verse length filter**: Short / Medium / Long (based on character count).
- **Blind Faith mode**:
  - Verse shown for 10s then hidden.
  - “Peek” option reveals for 5s (tracked by counter).
  - Fairness score (Levenshtein similarity to verse).
- **Typing feedback**:
  - Green for correct, red for incorrect keystrokes.
  - Must match exactly to complete.
- **Metrics**:
  - WPM (based on correct chars)
  - Accuracy (every incorrect keystroke counts, even if corrected)
  - Elapsed time
- **Session stats**:
  - Best WPM, best accuracy, fastest time, best fairness (Blind Faith).
  - Session history table with timestamp, verse, category, mode, WPM, accuracy, fairness.
  - CSV export.
- **Keyboard shortcuts**:
  - `Ctrl+Enter` → Finish attempt
  - `Ctrl+P` → Peek (5s)
  - `Ctrl+R` → Restart verse
  - `Ctrl+M` → New verse

---

## How it works

### Backend (`server.py`)
- Proxies and normalizes verse content:
  - **bible-api.com** for KJV/WEB
  - **api.bible** for FBV (and others if configured)
- Uses `/search` → resolve human ref → `/passages/{OSIS}` → strip HTML → return plain text.
- Adds CORS support so the front-end can call it directly.
- Provides `/verse` endpoint:  
  `GET /verse?ref=John%203:16&version=FBV`

### Frontend (`index.html`)
- Unified fetch: tries FastAPI proxy first; falls back to bible-api.com for KJV/WEB if proxy not running.
- Implements typing UI, Blind Faith mode, scoring, stats, and CSV export.

---

## File layout

```
.
├─ server.py    # FastAPI proxy for verse fetching
├─ index.html   # Front-end game UI (all-in-one HTML/CSS/JS)
└─ README.md    # Project documentation
```

---

## Configuration (edit in code)

Open `index.html` and look for these constants:
- **Timers**  
  - `BLIND_PREVIEW_MS = 10000` (initial 10s preview)  
  - `BLIND_PEEK_MS = 5000` (5s peek)
- **Length thresholds**  
  - `LEN_THRESHOLDS.shortMax = 110`  
  - `LEN_THRESHOLDS.mediumMax = 230`
- **Categories & references**  
  - `VERSE_CATEGORIES` (add/remove passages; they’ll automatically be available in “All” and reverse-mapped to show the actual category title).

  ---

## Adding more translations

- Extend `VERSION_MAP` in `server.py`:
  ```python
  VERSION_MAP = {
      "KJV": {"provider": "bibleapi", "id": None},
      "WEB": {"provider": "bibleapi", "id": "web"},
      "FBV": {"provider": "apibible", "id": "65eec8e0b60e656b-01"},
      "ICV": {"provider": "apibible", "id": "a36fc06b086699f1-02"}, # Igbo Contemporary
      "YCV": {"provider": "apibible", "id": "b8d1feac6e94bd74-01"}, # Yoruba Contemporary
  }
  ```
- Restart the server.
- Add the version to the `<select>` dropdown in `index.html`.

---

## Troubleshooting

- **FBV/other api.bible versions return 500**: ensure `$env:API_BIBLE_KEY` is set and valid.
- **CORS errors**: make sure `server.py` has CORS enabled (already included).
- **Nothing loads**: run index.html from a local server (`http://localhost:8080`) instead of double-clicking.

---

## Roadmap ideas

- Backend proxy for **more translations** (NIV/ESV/CSB/NLT, etc.) with caching and rate limiting.  
- **Verse pools** per category with more curated references and difficulty tagging.  
- **Multiplayer** lobbies / ghost races.  
- **User profiles** and analytics (local-first or privacy-friendly backend).  
- **Audio** cues and simple **animations** for fun feedback.

---

## License & attribution

- **KJV**: public domain.  
- **WEB**: public domain.  
- **FBV**: © Dr. Jonathan Gallagher, released under Creative Commons Attribution-ShareAlike 4.0. Attribution line is returned in API and displayed in UI.  
- Other translations: check publisher’s license.

---
