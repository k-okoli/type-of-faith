# Multiplayer & Leaderboard Architecture

## Overview

This document outlines the architecture for adding multiplayer racing and global leaderboards to Type of Faith. The design prioritizes simplicity while enabling real-time competitive play.

---

## 1. Technology Stack

| Component | Recommended | Alternative |
|-----------|-------------|-------------|
| **Database** | SQLite (dev) → PostgreSQL (prod) | Supabase (hosted Postgres + auth) |
| **Backend** | FastAPI (existing) + WebSockets | Node.js + Socket.io |
| **Auth** | Simple username + session token | Supabase Auth, Firebase Auth |
| **Hosting** | Railway / Render / Fly.io | Supabase (all-in-one) |
| **Real-time** | FastAPI WebSockets | Pusher, Ably (managed) |

**Recommendation:** Extend the existing FastAPI server with SQLAlchemy + WebSockets. Use Supabase if you want managed infrastructure with minimal backend code.

---

## 2. Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(20) UNIQUE NOT NULL,
    display_name VARCHAR(50),
    avatar_id VARCHAR(30) DEFAULT 'moses',
    created_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW(),

    -- Stats (denormalized for fast reads)
    total_races INTEGER DEFAULT 0,
    races_won INTEGER DEFAULT 0,
    best_wpm INTEGER DEFAULT 0,
    total_practice_sessions INTEGER DEFAULT 0
);

-- Session tokens (simple auth)
CREATE TABLE sessions (
    token VARCHAR(64) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

-- Daily challenge scores
CREATE TABLE daily_scores (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    challenge_date DATE NOT NULL,
    wpm INTEGER NOT NULL,
    accuracy INTEGER NOT NULL,
    time_seconds DECIMAL(6,2) NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, challenge_date)  -- One score per user per day
);

-- Race results
CREATE TABLE race_results (
    id SERIAL PRIMARY KEY,
    race_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    verse_ref VARCHAR(50) NOT NULL,
    place INTEGER NOT NULL,
    wpm INTEGER NOT NULL,
    accuracy INTEGER NOT NULL,
    time_seconds DECIMAL(6,2) NOT NULL,
    finished_at TIMESTAMP DEFAULT NOW()
);

-- Race lobbies (for matchmaking)
CREATE TABLE race_lobbies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID REFERENCES users(id),
    verse_ref VARCHAR(50) NOT NULL,
    verse_text TEXT NOT NULL,
    version VARCHAR(10) DEFAULT 'KJV',
    max_players INTEGER DEFAULT 4,
    status VARCHAR(20) DEFAULT 'waiting',  -- waiting, countdown, racing, finished
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    finished_at TIMESTAMP
);

-- Lobby participants
CREATE TABLE lobby_players (
    lobby_id UUID REFERENCES race_lobbies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    ready BOOLEAN DEFAULT FALSE,
    progress INTEGER DEFAULT 0,  -- characters typed correctly
    finished BOOLEAN DEFAULT FALSE,
    finish_time DECIMAL(6,2),
    wpm INTEGER,

    PRIMARY KEY (lobby_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_daily_scores_date ON daily_scores(challenge_date);
CREATE INDEX idx_daily_scores_wpm ON daily_scores(challenge_date, wpm DESC);
CREATE INDEX idx_race_results_user ON race_results(user_id);
CREATE INDEX idx_lobbies_status ON race_lobbies(status);
```

---

## 3. Authentication Flow

Simple token-based auth (no passwords, no OAuth complexity):

```
1. User visits site for first time
   → Prompt: "Enter a username to join"
   → POST /auth/register { username: "PlayerOne" }
   → Response: { user_id, token, username }
   → Store token in localStorage

2. Returning user
   → Read token from localStorage
   → GET /auth/me (with Authorization header)
   → Response: { user_id, username, stats }

3. Token expired or invalid
   → Clear localStorage, show username prompt again
```

**Why no passwords?**
- Lower friction for a typing game
- Users can always create a new account
- Serious users can link email later (future feature)

---

## 4. API Endpoints

### Authentication
```
POST /auth/register
  Body: { username: string }
  Response: { user_id, token, username }

GET /auth/me
  Headers: Authorization: Bearer <token>
  Response: { user_id, username, avatar_id, stats }

POST /auth/logout
  Headers: Authorization: Bearer <token>
  Response: { ok: true }
```

### Leaderboards
```
GET /leaderboard/daily?date=2024-01-15
  Response: {
    date: "2024-01-15",
    verse_ref: "John 3:16",
    scores: [
      { rank: 1, username: "SpeedTyper", wpm: 85, accuracy: 98, time: 12.5 },
      { rank: 2, username: "FaithRunner", wpm: 72, accuracy: 100, time: 15.2 },
      ...
    ]
  }

GET /leaderboard/all-time?limit=100
  Response: {
    scores: [
      { rank: 1, username: "SpeedTyper", best_wpm: 95, races_won: 42 },
      ...
    ]
  }

POST /leaderboard/daily/submit
  Headers: Authorization: Bearer <token>
  Body: { wpm: 65, accuracy: 97, time_seconds: 18.5 }
  Response: { rank: 5, is_personal_best: true }
```

### Multiplayer Lobbies
```
GET /lobbies
  Response: {
    lobbies: [
      { id, host_username, verse_ref, player_count, max_players, status },
      ...
    ]
  }

POST /lobbies/create
  Headers: Authorization: Bearer <token>
  Body: { verse_ref: "Psalm 23:1", version: "KJV", max_players: 4 }
  Response: { lobby_id, join_code }

POST /lobbies/{id}/join
  Headers: Authorization: Bearer <token>
  Response: { lobby_id, verse_text, players }

POST /lobbies/{id}/ready
  Headers: Authorization: Bearer <token>
  Response: { ok: true }

POST /lobbies/{id}/leave
  Headers: Authorization: Bearer <token>
  Response: { ok: true }
```

---

## 5. WebSocket Protocol

### Connection
```javascript
const ws = new WebSocket('wss://api.example.com/ws/race/{lobby_id}?token={auth_token}');
```

### Message Types (Server → Client)
```json
// Player joined
{ "type": "player_joined", "user_id": "...", "username": "PlayerTwo", "avatar_id": "david" }

// Player left
{ "type": "player_left", "user_id": "..." }

// Player ready status
{ "type": "player_ready", "user_id": "...", "ready": true }

// Countdown started (all players ready)
{ "type": "countdown", "seconds": 3 }

// Race started
{ "type": "race_start", "verse_text": "For God so loved...", "start_time": 1705312800000 }

// Player progress update (broadcast to all)
{ "type": "progress", "user_id": "...", "chars": 45, "wpm": 62 }

// Player finished
{ "type": "player_finished", "user_id": "...", "place": 1, "time": 15.2, "wpm": 72 }

// Race ended (all finished or timeout)
{ "type": "race_end", "results": [...] }
```

### Message Types (Client → Server)
```json
// Mark ready
{ "type": "ready" }

// Progress update (send every 500ms or on significant change)
{ "type": "progress", "chars": 45, "wpm": 62 }

// Finished typing
{ "type": "finished", "time": 15.2, "wpm": 72, "accuracy": 98 }
```

---

## 6. Race Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        RACE LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. LOBBY CREATION                                              │
│     Host creates lobby → gets join code                         │
│     Lobby status: "waiting"                                     │
│                                                                 │
│  2. PLAYERS JOIN                                                │
│     Players join via code or lobby list                         │
│     WebSocket connection established                            │
│     Players see each other's avatars                            │
│                                                                 │
│  3. READY UP                                                    │
│     Each player clicks "Ready"                                  │
│     All ready → auto-start countdown                            │
│     Lobby status: "countdown"                                   │
│                                                                 │
│  4. COUNTDOWN                                                   │
│     3... 2... 1... GO!                                          │
│     Audio cues play                                             │
│     Input disabled until "GO"                                   │
│                                                                 │
│  5. RACING                                                      │
│     Lobby status: "racing"                                      │
│     Players type, progress broadcast every 500ms                │
│     Avatars move on everyone's screen                           │
│                                                                 │
│  6. FINISH                                                      │
│     First to complete gets 1st place                            │
│     Others continue until all finish or 2min timeout            │
│     Lobby status: "finished"                                    │
│     Results saved to database                                   │
│                                                                 │
│  7. REMATCH OR LEAVE                                            │
│     Host can start new race with same players                   │
│     Players can leave to find new lobby                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Frontend Changes

### New Page: `lobby.html`
- Lobby browser (list of waiting lobbies)
- Create lobby form
- Join by code input
- Waiting room UI (player list, ready buttons)
- Race arena (reuse from race.html)

### Updates to `race.html`
- Add "Play Online" button that opens lobby.html
- Keep "Play vs AI" as current functionality

### New Shared Module: `shared/multiplayer.js`
- WebSocket connection management
- Lobby API calls
- Auth token handling
- Progress sync utilities

### UI Components Needed
- Username prompt modal
- Lobby list with join buttons
- Waiting room with player avatars
- "Copy invite link" button
- Connection status indicator

---

## 8. Hosting Recommendations

### Option A: Extend Current Server (DIY)
```
Cost: ~$5-7/month
Stack: FastAPI + PostgreSQL + Redis (for WebSocket state)
Host: Railway or Render

Pros: Full control, uses existing code
Cons: More maintenance, need to handle scaling
```

### Option B: Supabase (Managed)
```
Cost: Free tier generous, then $25/month
Stack: Supabase (Postgres + Auth + Realtime)

Pros:
- Database, auth, and realtime built-in
- Generous free tier (500MB DB, 2GB bandwidth)
- Client libraries handle WebSocket complexity

Cons:
- Learning curve for Supabase specifics
- Less control over backend logic
```

### Option C: Hybrid
```
Cost: ~$5/month
Stack:
- Existing FastAPI for verse API
- Supabase for users, scores, and realtime

Pros: Best of both worlds
Cons: Two services to manage
```

**My recommendation:** Start with **Option A** (extend FastAPI) for consistency with existing code. Migrate to Supabase later if scaling becomes a concern.

---

## 9. Implementation Phases

### Phase 1: Leaderboards (1-2 days)
- [ ] Add database tables (users, sessions, daily_scores)
- [ ] Add auth endpoints (register, me, logout)
- [ ] Add daily leaderboard endpoints
- [ ] Update practice.html to submit scores
- [ ] Create leaderboard UI component

### Phase 2: Basic Multiplayer (3-5 days)
- [ ] Add lobby tables and endpoints
- [ ] Implement WebSocket server
- [ ] Create lobby.html page
- [ ] Implement race sync protocol
- [ ] Test with 2-4 players

### Phase 3: Polish (2-3 days)
- [ ] Add lobby browser with filters
- [ ] Add invite links / join codes
- [ ] Add rematch functionality
- [ ] Add spectator mode
- [ ] Handle disconnections gracefully

### Phase 4: Ghost Races (Optional)
- [ ] Record race replays (keystrokes + timestamps)
- [ ] Allow racing against past performances
- [ ] "Beat your best" mode

---

## 10. Security Considerations

1. **Rate limiting** — Already implemented, extend to new endpoints
2. **Input validation** — Validate username, verse refs, scores
3. **Anti-cheat** — Server validates finish time vs character count
4. **Token security** — Use secure random tokens, HTTPS only
5. **WebSocket auth** — Validate token on connection, not just HTTP

---

## 11. Example: Minimal Leaderboard Implementation

Here's a quick-start for adding daily leaderboards to the existing server:

```python
# Add to server.py

from sqlalchemy import create_engine, Column, String, Integer, DateTime, Date
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import secrets
from datetime import datetime, date

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tof.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    username = Column(String(20), unique=True, nullable=False)
    avatar_id = Column(String(30), default="moses")
    best_wpm = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Session(Base):
    __tablename__ = "sessions"
    token = Column(String(64), primary_key=True)
    user_id = Column(String, nullable=False)
    expires_at = Column(DateTime)

class DailyScore(Base):
    __tablename__ = "daily_scores"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False)
    challenge_date = Column(Date, nullable=False)
    wpm = Column(Integer, nullable=False)
    accuracy = Column(Integer, nullable=False)

Base.metadata.create_all(engine)

@app.post("/auth/register")
async def register(username: str):
    db = SessionLocal()
    # Check if username taken
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(400, "Username taken")

    user = User(id=secrets.token_hex(16), username=username)
    token = secrets.token_hex(32)
    session = Session(token=token, user_id=user.id)

    db.add(user)
    db.add(session)
    db.commit()

    return {"user_id": user.id, "token": token, "username": username}

@app.get("/leaderboard/daily")
async def daily_leaderboard(challenge_date: date = None):
    if not challenge_date:
        challenge_date = date.today()

    db = SessionLocal()
    scores = db.query(DailyScore, User.username)\
        .join(User, DailyScore.user_id == User.id)\
        .filter(DailyScore.challenge_date == challenge_date)\
        .order_by(DailyScore.wpm.desc())\
        .limit(100)\
        .all()

    return {
        "date": str(challenge_date),
        "scores": [
            {"rank": i+1, "username": s[1], "wpm": s[0].wpm, "accuracy": s[0].accuracy}
            for i, s in enumerate(scores)
        ]
    }
```

---

## Next Steps

1. **Decide on hosting** — Railway (extend FastAPI) or Supabase (managed)?
2. **Start with leaderboards** — Quickest win, builds auth foundation
3. **Add multiplayer incrementally** — Lobby system, then WebSockets

Ready to implement Phase 1 (leaderboards)?
