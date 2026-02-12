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
- [x] Countdown with audio cues
- [x] Results panel with standings

## Shared / Infrastructure
- [x] Extracted shared modules (nav, theme, data, audio)
- [x] Nav bar across all pages with mute button
- [x] FastAPI backend proxy (server.py)
- [x] Audio cues (correct/error keystrokes, complete, countdown, race finish)
- [x] Corrected character highlighting (yellow) across all pages
- [ ] Fix bugs
- [ ] Write unit tests

## Race Track / Avatars
- [x] Race track progress bar on all pages
- [ ] 3D avatar toggle (assets ready in assets/avatars/)
- [ ] Avatar unlocking through achievements

## Future Features
- [ ] Multiplayer mode / lobbies / ghost races
- [ ] Leaderboard (global daily challenge scores)
- [ ] Seasonal events/themed competitions (Christmas, Holy Week/Resurrection Sunday/Easter, Pentecost, Lent)
- [ ] User profiles and analytics
- [ ] More Bible translations (NIV, CSB, NLT, etc.)
- [ ] Animations for completion/achievements
