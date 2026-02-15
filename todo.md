# TODO List

## MVP Main Page (practice.html)
- [x] Verse fetching with multiple providers (KJV, WEB, FBV, ESV)
- [x] Category and verse length filters
- [x] Blind faith mode with configurable preview/peek timers
- [x] Typing feedback (green correct, red incorrect, yellow corrected)
- [x] Live metrics (WPM, accuracy, time)
- [x] Session stats and history table with CSV export
- [x] Keyboard shortcuts (Ctrl+Enter, Ctrl+P, Ctrl+R, Ctrl+M)
- [x] Dark/light theme toggle
- [x] Single player mode visuals — avatar selection + race track progress bar
- [x] Race track percentage indicator
- [x] Organized PNG assets into assets/avatars/
- [x] Blind faith mode — preview/peek inputs hidden until mode is activated
- [x] Daily challenge — date-seeded verse of the day with best score tracking

## Lessons Page (lessons.html)
- [x] Draft touch typing lesson feature
- [x] Lesson navigation (drill nav, prev/next, auto-advance)
- [x] Full keyboard map with numbers, shift, space, apostrophe
- [x] Seamless navigation between lessons and drills
- [x] Only highlight the key being pressed on keyboard map
- [x] Finger placement with image-based hands (3 skin tones)
- [x] Per-finger highlighting overlays
- [x] Accuracy stat matches Practice page (keystroke-based)
- [x] Retry banner with "Redo Drill" button when accuracy < 95%
- [x] Drill above keyboard layout for better flow

## Quiz Page (quiz.html)
- [x] Game mode where verse text pops up and you have to select the correct verse location
- [x] Enhance experience — allow users to browse verses before attempting quiz (Study Mode)

## Race Page (race.html)
- [x] Race mode page — compete against 1-3 AI opponents
- [x] Three AI modes: Fixed, Personality, Adaptive
- [x] Full-screen countdown overlay (3, 2, 1, GO!) with animations
- [x] Results panel with standings
- [x] Trophy/confetti celebrations for wins

## Shared / Infrastructure
- [x] Extracted shared modules (nav, theme, data, audio)
- [x] Nav bar across all pages with mute button
- [x] FastAPI backend proxy (server.py)
- [x] Audio cues (correct/error keystrokes, complete, countdown, race finish)
- [x] Corrected character highlighting (yellow) across all pages
- [x] Server improvements: async httpx, file-based cache with TTL, rate limiting, retry logic, logging
- [x] Fix bugs (daily challenge best score overwrite)
- [x] Write unit tests (pytest backend + JS frontend)

## Race Track / Avatars
- [x] Race track progress bar on all pages
- [ ] 3D avatar toggle (assets ready in assets/avatars/)
- [x] Avatar unlocking through achievements (7 avatars with unlock conditions)

## Future Features
- [x] Multiplayer mode / lobbies (Phase 2 complete — WebSocket real-time racing)
- [x] Leaderboard (global daily challenge scores) — Phase 1 complete (auth + daily leaderboard)
- [x] Seasonal events — Christmas & Easter/Holy Week (banners, themed verses, CSS accents, snowfall effect)
- [ ] More seasonal events (Lent, Pentecost)
- [ ] User profiles and analytics
- [ ] More Bible translations (NIV, CSB, NLT, etc.)
- [x] Animations for completion/achievements (confetti, trophy, milestone toasts, achievement unlocks)
