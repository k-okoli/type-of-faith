# TODO List

## MVP Main Page (index.html)
- [x] Verse fetching with multiple providers (KJV, WEB, FBV, ESV)
- [x] Category and verse length filters
- [x] Blind faith mode with configurable preview/peek timers
- [x] Typing feedback (green correct, red incorrect)
- [x] Live metrics (WPM, accuracy, time)
- [x] Session stats and history table with CSV export
- [x] Keyboard shortcuts (Ctrl+Enter, Ctrl+P, Ctrl+R, Ctrl+M)
- [x] Dark/light theme toggle
- [x] Single player mode visuals — avatar selection + race track progress bar
- [x] Race track percentage indicator
- [x] Organized PNG assets into assets/avatars/
- [x] Blind faith mode — preview/peek inputs hidden until mode is activated

## Lessons Page (lessons.html)
- [x] Draft touch typing lesson feature
- [x] Move drill under keyboard map section
- [x] Lesson navigation (drill nav, prev/next, auto-advance)
- [x] Full keyboard map with numbers, shift, space, apostrophe
- [x] Seamless navigation between lessons and drills
- [x] Only highlight the key being pressed on keyboard map
- [ ] Finger placement on the map (hand emoji with different skin tones?)
- [x] Accuracy stat not the same as it is in the Practice page

## Quiz Page (quiz.html)
- [x] Game mode where verse text pops up and you have to select the correct verse location
- [x] Enhance experience — allow users to browse verses before attempting quiz

## Shared / Infrastructure
- [x] Extracted shared modules (nav, theme, data)
- [x] Nav bar across all pages
- [x] FastAPI backend proxy (server.py)
- [ ] Fix bugs
- [ ] Write unit tests

## Race Track / Avatars
- [x] Race mode page — AI opponents / ghost replays
- [ ] 3D avatar toggle (assets ready in assets/avatars/)
- [ ] Avatar unlocking through achievements
- [x] Add race track to lessons.html and quiz.html

## Future Features
- [ ] Multiplayer mode / lobbies / ghost races
- [ ] Leaderboard
- [ ] Daily challenges
- [ ] Seasonal events/themed competitions (Christmas, Holy Week/Resurrection Sunday/Easter, Pentecost, Lent)
- [ ] User profiles and analytics
- [ ] Audio cues and animations
- [ ] More Bible translations (NIV, CSB, NLT, etc.)
