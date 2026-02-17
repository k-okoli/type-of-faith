# server.py
import os
import re
import json
import hashlib
import logging
import time
import secrets
from pathlib import Path
from typing import Optional
from datetime import datetime, date, timedelta

from fastapi import FastAPI, HTTPException, Query, Request, Header, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import httpx
from typing import Dict, List, Set
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# SQLAlchemy for database
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Date, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session as DBSession

# ---------- Logging ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

# ---------- App Setup ----------
load_dotenv()
API_BIBLE_KEY = os.getenv("API_BIBLE_KEY")
API_BIBLE_BASE = "https://api.scripture.api.bible/v1"

# ---------- Database Setup ----------
# SQLite for development. For production, use PostgreSQL:
# DATABASE_URL = "postgresql://user:pass@host/dbname"
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tof_data.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ---------- Database Models ----------
class User(Base):
    """
    User account - just a username and stats.
    No password! The session token acts as proof of ownership.
    """
    __tablename__ = "users"

    id = Column(String(32), primary_key=True)  # Random hex ID
    username = Column(String(20), unique=True, nullable=False, index=True)
    avatar_id = Column(String(30), default="moses")
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)

    # Denormalized stats for fast leaderboard queries
    best_wpm = Column(Integer, default=0)
    total_races = Column(Integer, default=0)
    races_won = Column(Integer, default=0)
    practice_sessions = Column(Integer, default=0)


class UserSession(Base):
    """
    Session token - this IS the user's "password".
    Whoever has this token can act as the user.
    Stored in browser's localStorage.
    """
    __tablename__ = "sessions"

    token = Column(String(64), primary_key=True)  # Random hex token
    user_id = Column(String(32), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(days=90))


class DailyScore(Base):
    """
    Daily challenge leaderboard entries.
    One entry per user per day (upsert on resubmit).
    """
    __tablename__ = "daily_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(32), nullable=False, index=True)
    challenge_date = Column(Date, nullable=False, index=True)
    verse_ref = Column(String(50))
    wpm = Column(Integer, nullable=False)
    accuracy = Column(Integer, nullable=False)
    time_seconds = Column(Float, nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)


class RaceLobby(Base):
    """
    A multiplayer race lobby/room.
    Players join, ready up, race, then results are recorded.
    """
    __tablename__ = "race_lobbies"

    id = Column(String(32), primary_key=True)  # Random hex ID
    join_code = Column(String(6), unique=True, index=True)  # Short code for joining
    host_id = Column(String(32), nullable=False)
    verse_ref = Column(String(50), nullable=False)
    verse_text = Column(String(2000), nullable=False)
    version = Column(String(10), default="WEB")
    max_players = Column(Integer, default=4)
    status = Column(String(20), default="waiting")  # waiting, countdown, racing, finished
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)


class LobbyPlayer(Base):
    """
    A player in a race lobby.
    Tracks their ready status, progress during race, and final results.
    """
    __tablename__ = "lobby_players"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lobby_id = Column(String(32), nullable=False, index=True)
    user_id = Column(String(32), nullable=False, index=True)
    joined_at = Column(DateTime, default=datetime.utcnow)
    ready = Column(Boolean, default=False)
    progress = Column(Integer, default=0)  # Characters typed correctly
    finished = Column(Boolean, default=False)
    finish_time = Column(Float, nullable=True)  # Seconds to complete
    wpm = Column(Integer, nullable=True)
    place = Column(Integer, nullable=True)  # 1st, 2nd, etc.


# Create tables on startup
Base.metadata.create_all(bind=engine)
logger.info("Database tables created/verified")


# ---------- Database Dependency ----------
def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- Auth Helpers ----------
def get_current_user(
    authorization: Optional[str] = Header(None),
    db: DBSession = Depends(get_db)
) -> Optional[User]:
    """
    Extract user from Authorization header.
    Returns None if no token or invalid token.
    """
    if not authorization:
        return None

    # Expect "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1]

    # Look up session
    session = db.query(UserSession).filter(
        UserSession.token == token,
        UserSession.expires_at > datetime.utcnow()
    ).first()

    if not session:
        return None

    # Look up user
    user = db.query(User).filter(User.id == session.user_id).first()
    if user:
        # Update last seen
        user.last_seen = datetime.utcnow()
        db.commit()

    return user


def require_auth(
    authorization: Optional[str] = Header(None),
    db: DBSession = Depends(get_db)
) -> User:
    """Like get_current_user but raises 401 if not authenticated."""
    user = get_current_user(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ---------- Request/Response Models ----------
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=20, pattern=r'^[a-zA-Z0-9_]+$')


class RegisterResponse(BaseModel):
    user_id: str
    username: str
    token: str  # This is their "password" - store it safely!


class UserResponse(BaseModel):
    user_id: str
    username: str
    avatar_id: str
    best_wpm: int
    total_races: int
    races_won: int
    practice_sessions: int


class ScoreSubmitRequest(BaseModel):
    wpm: int = Field(..., ge=1, le=300)
    accuracy: int = Field(..., ge=0, le=100)
    time_seconds: float = Field(..., ge=0.1, le=600)
    verse_ref: Optional[str] = None


class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    avatar_id: str
    wpm: int
    accuracy: int
    time_seconds: float


# ---------- Lobby Request/Response Models ----------
class CreateLobbyRequest(BaseModel):
    verse_ref: str = Field(..., min_length=3)
    version: str = Field(default="WEB")
    max_players: int = Field(default=4, ge=2, le=8)


class LobbyResponse(BaseModel):
    id: str
    join_code: str
    host_username: str
    verse_ref: str
    status: str
    player_count: int
    max_players: int


class LobbyDetailResponse(BaseModel):
    id: str
    join_code: str
    host_username: str
    verse_ref: str
    verse_text: str
    version: str
    status: str
    max_players: int
    players: list


# ---------- WebSocket Connection Manager ----------
class ConnectionManager:
    """
    Manages WebSocket connections for race lobbies.
    Each lobby has its own set of connected players.
    """
    def __init__(self):
        # lobby_id -> {user_id: websocket}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # lobby_id -> {user_id: {"progress": int, "wpm": int, "finished": bool, ...}}
        self.race_state: Dict[str, Dict[str, dict]] = {}

    async def connect(self, lobby_id: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if lobby_id not in self.active_connections:
            self.active_connections[lobby_id] = {}
            self.race_state[lobby_id] = {}
        self.active_connections[lobby_id][user_id] = websocket
        self.race_state[lobby_id][user_id] = {
            "progress": 0,
            "wpm": 0,
            "finished": False,
            "finish_time": None
        }

    def disconnect(self, lobby_id: str, user_id: str):
        if lobby_id in self.active_connections:
            self.active_connections[lobby_id].pop(user_id, None)
            if not self.active_connections[lobby_id]:
                del self.active_connections[lobby_id]
                self.race_state.pop(lobby_id, None)

    async def broadcast_to_lobby(self, lobby_id: str, message: dict):
        """Send message to all players in a lobby."""
        if lobby_id in self.active_connections:
            disconnected = []
            for user_id, ws in self.active_connections[lobby_id].items():
                try:
                    await ws.send_json(message)
                except Exception:
                    disconnected.append(user_id)
            # Clean up disconnected
            for user_id in disconnected:
                self.disconnect(lobby_id, user_id)

    async def send_to_user(self, lobby_id: str, user_id: str, message: dict):
        """Send message to a specific user."""
        if lobby_id in self.active_connections:
            ws = self.active_connections[lobby_id].get(user_id)
            if ws:
                try:
                    await ws.send_json(message)
                except Exception:
                    self.disconnect(lobby_id, user_id)

    def get_connected_users(self, lobby_id: str) -> List[str]:
        """Get list of connected user IDs for a lobby."""
        if lobby_id in self.active_connections:
            return list(self.active_connections[lobby_id].keys())
        return []

    def update_player_state(self, lobby_id: str, user_id: str, **kwargs):
        """Update a player's race state."""
        if lobby_id in self.race_state and user_id in self.race_state[lobby_id]:
            self.race_state[lobby_id][user_id].update(kwargs)

    def get_race_state(self, lobby_id: str) -> dict:
        """Get the full race state for a lobby."""
        return self.race_state.get(lobby_id, {})


# Global WebSocket manager
ws_manager = ConnectionManager()


# Rate limiting: 60 requests/minute per IP
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Type of Faith API", version="1.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Track server start time for health check
SERVER_START = datetime.now()

# ---------- Config ----------
VERSION_MAP = {
    "KJV": {"provider": "bibleapi", "id": None},
    "WEB": {"provider": "bibleapi", "id": "web"},
    "FBV": {"provider": "apibible", "id": "65eec8e0b60e656b-01"},
    "ICV": {"provider": "apibible", "id": "a36fc06b086699f1-02"},
    "YCV": {"provider": "apibible", "id": "b8d1feac6e94bd74-01"},
}

OSIS_RE = re.compile(r"^[A-Z0-9]{3}\.\d+(\.\d+)?$", re.IGNORECASE)

# ---------- CORS ----------
# Production: add your deployed domain to this list
# Allow any origin for dev/LAN use. In production, replace "*" with your domain.
ALLOWED_ORIGINS = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],  # POST for auth and score submission
    allow_headers=["*"],
)

# ---------- File-based Cache with TTL ----------
CACHE_DIR = Path(__file__).parent / ".cache"
CACHE_TTL_SECONDS = 86400  # 24 hours
CACHE_MAX_ENTRIES = 5000

def _cache_key(version: str, ref: str) -> str:
    """Generate a safe filename from version and reference."""
    raw = f"{version}|{ref}".lower().strip()
    return hashlib.md5(raw.encode()).hexdigest()

def _cache_path(key: str) -> Path:
    return CACHE_DIR / f"{key}.json"

def get_cache(version: str, ref: str) -> Optional[dict]:
    """Retrieve cached verse if exists and not expired."""
    CACHE_DIR.mkdir(exist_ok=True)
    key = _cache_key(version, ref)
    path = _cache_path(key)

    if not path.exists():
        return None

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        cached_at = data.get("_cached_at", 0)
        if time.time() - cached_at > CACHE_TTL_SECONDS:
            path.unlink(missing_ok=True)
            logger.debug(f"Cache expired: {version} {ref}")
            return None
        logger.debug(f"Cache hit: {version} {ref}")
        return data.get("payload")
    except (json.JSONDecodeError, IOError) as e:
        logger.warning(f"Cache read error: {e}")
        return None

def set_cache(version: str, ref: str, payload: dict) -> None:
    """Store verse in cache with timestamp."""
    CACHE_DIR.mkdir(exist_ok=True)

    # Prune if too many entries
    _prune_cache_if_needed()

    key = _cache_key(version, ref)
    path = _cache_path(key)
    data = {"_cached_at": time.time(), "payload": payload}

    try:
        path.write_text(json.dumps(data), encoding="utf-8")
        logger.debug(f"Cached: {version} {ref}")
    except IOError as e:
        logger.warning(f"Cache write error: {e}")

def _prune_cache_if_needed() -> None:
    """Remove oldest entries if cache exceeds max size."""
    try:
        entries = list(CACHE_DIR.glob("*.json"))
        if len(entries) <= CACHE_MAX_ENTRIES:
            return

        # Sort by modification time, oldest first
        entries.sort(key=lambda p: p.stat().st_mtime)
        to_remove = len(entries) - CACHE_MAX_ENTRIES + 100  # Remove 100 extra for headroom

        for path in entries[:to_remove]:
            path.unlink(missing_ok=True)

        logger.info(f"Pruned {to_remove} cache entries")
    except Exception as e:
        logger.warning(f"Cache prune error: {e}")

def get_cache_stats() -> dict:
    """Get cache statistics for health check."""
    try:
        CACHE_DIR.mkdir(exist_ok=True)
        entries = list(CACHE_DIR.glob("*.json"))
        total_size = sum(p.stat().st_size for p in entries)
        return {
            "entries": len(entries),
            "size_kb": round(total_size / 1024, 1),
            "max_entries": CACHE_MAX_ENTRIES,
            "ttl_hours": CACHE_TTL_SECONDS // 3600
        }
    except Exception:
        return {"entries": 0, "size_kb": 0}

# ---------- HTTP Client with Retry ----------
MAX_RETRIES = 3
RETRY_DELAYS = [0.5, 1.0, 2.0]  # Exponential backoff

async def fetch_with_retry(
    client: httpx.AsyncClient,
    url: str,
    headers: Optional[dict] = None,
    params: Optional[dict] = None
) -> httpx.Response:
    """Fetch URL with exponential backoff retry."""
    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            response = await client.get(url, headers=headers, params=params, timeout=12.0)

            # Don't retry client errors (4xx) except 429 (rate limit)
            if response.status_code < 500 and response.status_code != 429:
                return response

            # Log and retry on server errors
            logger.warning(f"Attempt {attempt + 1} failed: {url} returned {response.status_code}")
            last_error = response

        except httpx.RequestError as e:
            logger.warning(f"Attempt {attempt + 1} failed: {url} - {e}")
            last_error = e

        if attempt < MAX_RETRIES - 1:
            await asyncio.sleep(RETRY_DELAYS[attempt])

    # Return last response or raise last error
    if isinstance(last_error, httpx.Response):
        return last_error
    raise HTTPException(status_code=502, detail=f"Request failed after {MAX_RETRIES} attempts")

# ---------- api.bible helpers ----------
import asyncio

def _strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "")

async def apibible_search_resolve_osis(client: httpx.AsyncClient, bible_id: str, ref: str) -> str:
    """Resolve 'John 3:16' -> 'JHN.3.16' using /search."""
    if not API_BIBLE_KEY:
        raise HTTPException(status_code=500, detail="Server missing API_BIBLE_KEY")

    headers = {"api-key": API_BIBLE_KEY}
    url = f"{API_BIBLE_BASE}/bibles/{bible_id}/search"
    params = {"query": ref, "limit": 1}

    r = await fetch_with_retry(client, url, headers=headers, params=params)

    if r.status_code == 401:
        logger.error("API Bible key invalid")
        raise HTTPException(status_code=500, detail="API Bible key invalid")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"api.bible search error {r.status_code}")

    data = r.json().get("data") or {}
    verses = data.get("verses") or []
    if verses and verses[0].get("id"):
        return verses[0]["id"]
    passages = data.get("passages") or []
    if passages and passages[0].get("id"):
        return passages[0]["id"]

    raise HTTPException(status_code=404, detail=f"No OSIS id found for reference: {ref}")

async def apibible_fetch_passage_by_osis(client: httpx.AsyncClient, bible_id: str, osis: str) -> dict:
    """Call /passages/{OSIS} with params, then strip HTML to plain text."""
    if not API_BIBLE_KEY:
        raise HTTPException(status_code=500, detail="Server missing API_BIBLE_KEY")

    headers = {"api-key": API_BIBLE_KEY}
    url = f"{API_BIBLE_BASE}/bibles/{bible_id}/passages/{osis}"
    params = {
        "content-type": "html",
        "include-notes": "false",
        "include-titles": "true",
        "include-chapter-numbers": "false",
        "include-verse-numbers": "false",
        "include-verse-spans": "false",
        "use-org-id": "false",
    }

    r = await fetch_with_retry(client, url, headers=headers, params=params)

    if r.status_code == 401:
        logger.error("API Bible key invalid")
        raise HTTPException(status_code=500, detail="API Bible key invalid")
    if r.status_code == 403:
        raise HTTPException(status_code=403, detail="Bible unauthorized for this key")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"api.bible error {r.status_code}")

    d = r.json().get("data", {})
    reference = d.get("reference", osis)
    html = d.get("content") or ""
    text = " ".join(_strip_html(html).split())

    out = {"reference": reference, "text": text}
    if d.get("copyright"):
        out["copyright"] = d["copyright"]
    return out

async def fetch_apibible(client: httpx.AsyncClient, bible_id: str, ref: str) -> dict:
    """If ref is OSIS, fetch directly; else /search -> OSIS -> /passages/{OSIS}."""
    osis = ref if OSIS_RE.match(ref) else await apibible_search_resolve_osis(client, bible_id, ref)
    return await apibible_fetch_passage_by_osis(client, bible_id, osis)

# ---------- bible-api.com (KJV/WEB) ----------
async def fetch_bibleapi(client: httpx.AsyncClient, ref: str, trans: Optional[str] = None) -> dict:
    url = f"https://bible-api.com/{ref}"
    params = {}
    if trans and trans.lower() != "kjv":
        params["translation"] = trans.lower()

    r = await fetch_with_retry(client, url, params=params)

    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"bible-api.com error {r.status_code}")

    j = r.json()
    if "verses" in j and j["verses"]:
        text = " ".join(v["text"].strip() for v in j["verses"])
    else:
        text = j.get("text", "") or ""
    text = " ".join(text.split())
    reference = j.get("reference", ref)
    version = (params.get("translation") or "kjv").upper()

    return {"reference": reference, "text": text, "version": version}

# ---------- API Endpoints ----------
@app.get("/health")
async def health():
    """Health check with server stats."""
    uptime = datetime.now() - SERVER_START
    cache_stats = get_cache_stats()

    return {
        "ok": True,
        "version": "1.1.0",
        "uptime_seconds": int(uptime.total_seconds()),
        "uptime_human": str(uptime).split(".")[0],
        "cache": cache_stats,
        "api_bible_configured": bool(API_BIBLE_KEY),
        "supported_versions": list(VERSION_MAP.keys())
    }

@app.get("/verse")
@limiter.limit("60/minute")
async def get_verse(request: Request, ref: str = Query(..., min_length=1), version: str = Query("WEB")):
    """
    Fetch a Bible verse.

    Query params:
      - ref: 'John 3:16' (human) or 'JHN.3.16' (OSIS)
      - version: KJV, WEB (bible-api.com) or FBV/ICV/YCV (api.bible)
    """
    version = version.upper().strip()
    if version not in VERSION_MAP:
        raise HTTPException(status_code=400, detail=f"Unsupported version: {version}")

    # Check cache first
    cached = get_cache(version, ref)
    if cached:
        logger.info(f"Cache hit: {version} {ref}")
        return JSONResponse(cached)

    logger.info(f"Fetching: {version} {ref}")
    cfg = VERSION_MAP[version]
    provider = cfg["provider"]

    async with httpx.AsyncClient() as client:
        if provider == "bibleapi":
            trans = "kjv" if version == "KJV" else (cfg.get("id") or "kjv")
            out = await fetch_bibleapi(client, ref, trans)
        elif provider == "apibible":
            bible_id = cfg.get("id")
            if not bible_id:
                raise HTTPException(status_code=400, detail=f"No bibleId configured for version {version}")
            base = await fetch_apibible(client, bible_id, ref)
            out = {"reference": base["reference"], "text": base["text"], "version": version}
            if base.get("copyright"):
                out["copyright"] = base["copyright"]
        else:
            raise HTTPException(status_code=500, detail=f"Bad provider: {provider}")

    if not out.get("text"):
        raise HTTPException(status_code=404, detail=f"No verse text found for {version} {ref}")

    # Cache the result
    set_cache(version, ref, out)
    logger.info(f"Fetched and cached: {version} {ref}")

    return JSONResponse(out)

@app.get("/cache/clear")
@limiter.limit("5/minute")
async def clear_cache(request: Request):
    """Clear all cached verses (admin endpoint)."""
    try:
        CACHE_DIR.mkdir(exist_ok=True)
        entries = list(CACHE_DIR.glob("*.json"))
        count = len(entries)
        for path in entries:
            path.unlink(missing_ok=True)
        logger.info(f"Cache cleared: {count} entries removed")
        return {"ok": True, "cleared": count}
    except Exception as e:
        logger.error(f"Cache clear failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================
# AUTH ENDPOINTS
# ==============================================

@app.post("/auth/register", response_model=RegisterResponse)
@limiter.limit("10/minute")
async def register(request: Request, body: RegisterRequest, db: DBSession = Depends(get_db)):
    """
    Register a new user with just a username.

    How it works:
    1. You pick a username (must be unique)
    2. Server creates your account and returns a TOKEN
    3. Store that token in localStorage - it's your "password"
    4. Include it in future requests to prove who you are

    If you lose the token (clear browser data), you lose the account.
    For a typing game, that's an acceptable tradeoff for simplicity.
    """
    username = body.username.strip()

    # Check if username is taken
    existing = db.query(User).filter(User.username.ilike(username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Create user with random ID
    user_id = secrets.token_hex(16)
    user = User(id=user_id, username=username)
    db.add(user)

    # Create session token - this IS their password
    token = secrets.token_hex(32)
    session = UserSession(token=token, user_id=user_id)
    db.add(session)

    db.commit()
    logger.info(f"New user registered: {username}")

    return RegisterResponse(user_id=user_id, username=username, token=token)


@app.get("/auth/me", response_model=UserResponse)
async def get_me(user: User = Depends(require_auth)):
    """
    Get current user info.

    Requires Authorization header: Bearer <token>
    """
    return UserResponse(
        user_id=user.id,
        username=user.username,
        avatar_id=user.avatar_id,
        best_wpm=user.best_wpm,
        total_races=user.total_races,
        races_won=user.races_won,
        practice_sessions=user.practice_sessions
    )


@app.post("/auth/logout")
async def logout(
    authorization: Optional[str] = Header(None),
    db: DBSession = Depends(get_db)
):
    """
    Invalidate the current session token.
    """
    if authorization:
        parts = authorization.split()
        if len(parts) == 2:
            token = parts[1]
            db.query(UserSession).filter(UserSession.token == token).delete()
            db.commit()

    return {"ok": True}


# ==============================================
# LEADERBOARD ENDPOINTS
# ==============================================

@app.get("/leaderboard/daily")
async def get_daily_leaderboard(
    request: Request,
    challenge_date: Optional[date] = None,
    limit: int = Query(50, ge=1, le=100),
    db: DBSession = Depends(get_db)
):
    """
    Get daily challenge leaderboard.

    Query params:
    - challenge_date: YYYY-MM-DD (defaults to today)
    - limit: max results (1-100, default 50)
    """
    if not challenge_date:
        challenge_date = date.today()

    # Query scores joined with usernames
    scores = db.query(DailyScore, User.username, User.avatar_id)\
        .join(User, DailyScore.user_id == User.id)\
        .filter(DailyScore.challenge_date == challenge_date)\
        .order_by(DailyScore.wpm.desc(), DailyScore.time_seconds.asc())\
        .limit(limit)\
        .all()

    return {
        "date": str(challenge_date),
        "scores": [
            {
                "rank": i + 1,
                "username": s[1],
                "avatar_id": s[2],
                "wpm": s[0].wpm,
                "accuracy": s[0].accuracy,
                "time_seconds": round(s[0].time_seconds, 2)
            }
            for i, s in enumerate(scores)
        ]
    }


@app.post("/leaderboard/daily/submit")
@limiter.limit("30/minute")
async def submit_daily_score(
    request: Request,
    body: ScoreSubmitRequest,
    user: User = Depends(require_auth),
    db: DBSession = Depends(get_db)
):
    """
    Submit a daily challenge score.

    - Only one score per user per day (keeps the best)
    - Requires authentication

    Returns your rank on today's leaderboard.
    """
    today = date.today()

    # Check for existing score today
    existing = db.query(DailyScore).filter(
        DailyScore.user_id == user.id,
        DailyScore.challenge_date == today
    ).first()

    is_new_best = False

    if existing:
        # Only update if new score is better (higher WPM wins)
        if body.wpm > existing.wpm:
            existing.wpm = body.wpm
            existing.accuracy = body.accuracy
            existing.time_seconds = body.time_seconds
            existing.verse_ref = body.verse_ref
            existing.submitted_at = datetime.utcnow()
            is_new_best = True
            logger.info(f"Updated daily score for {user.username}: {body.wpm} WPM")
    else:
        # First submission today
        score = DailyScore(
            user_id=user.id,
            challenge_date=today,
            verse_ref=body.verse_ref,
            wpm=body.wpm,
            accuracy=body.accuracy,
            time_seconds=body.time_seconds
        )
        db.add(score)
        is_new_best = True
        logger.info(f"New daily score for {user.username}: {body.wpm} WPM")

    # Update user's best WPM if this beats it
    if body.wpm > user.best_wpm:
        user.best_wpm = body.wpm

    user.practice_sessions += 1
    db.commit()

    # Calculate rank
    rank = db.query(DailyScore).filter(
        DailyScore.challenge_date == today,
        DailyScore.wpm > body.wpm
    ).count() + 1

    total_today = db.query(DailyScore).filter(
        DailyScore.challenge_date == today
    ).count()

    return {
        "ok": True,
        "rank": rank,
        "total_players": total_today,
        "is_personal_best": is_new_best,
        "message": f"You're #{rank} out of {total_today} players today!"
    }


@app.get("/leaderboard/alltime")
async def get_alltime_leaderboard(
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    db: DBSession = Depends(get_db)
):
    """
    Get all-time leaderboard by best WPM.
    """
    users = db.query(User)\
        .filter(User.best_wpm > 0)\
        .order_by(User.best_wpm.desc())\
        .limit(limit)\
        .all()

    return {
        "scores": [
            {
                "rank": i + 1,
                "username": u.username,
                "avatar_id": u.avatar_id,
                "best_wpm": u.best_wpm,
                "races_won": u.races_won,
                "practice_sessions": u.practice_sessions
            }
            for i, u in enumerate(users)
        ]
    }


# ==============================================
# MULTIPLAYER LOBBY ENDPOINTS
# ==============================================

def generate_join_code() -> str:
    """Generate a short, memorable join code like 'ABC123'."""
    import random
    import string
    letters = ''.join(random.choices(string.ascii_uppercase, k=3))
    numbers = ''.join(random.choices(string.digits, k=3))
    return letters + numbers


@app.get("/lobbies")
async def list_lobbies(
    request: Request,
    status: str = Query("waiting"),
    db: DBSession = Depends(get_db)
):
    """
    List available lobbies.

    Query params:
    - status: 'waiting', 'racing', or 'all' (default: 'waiting')
    """
    query = db.query(RaceLobby, User.username)\
        .join(User, RaceLobby.host_id == User.id)

    if status != "all":
        query = query.filter(RaceLobby.status == status)

    # Only show recent lobbies (last hour)
    cutoff = datetime.utcnow() - timedelta(hours=1)
    query = query.filter(RaceLobby.created_at > cutoff)

    lobbies = query.order_by(RaceLobby.created_at.desc()).limit(20).all()

    result = []
    for lobby, host_username in lobbies:
        player_count = db.query(LobbyPlayer).filter(
            LobbyPlayer.lobby_id == lobby.id
        ).count()
        result.append({
            "id": lobby.id,
            "join_code": lobby.join_code,
            "host_username": host_username,
            "verse_ref": lobby.verse_ref,
            "status": lobby.status,
            "player_count": player_count,
            "max_players": lobby.max_players
        })

    return {"lobbies": result}


@app.post("/lobbies/create")
@limiter.limit("10/minute")
async def create_lobby(
    request: Request,
    body: CreateLobbyRequest,
    user: User = Depends(require_auth),
    db: DBSession = Depends(get_db)
):
    """
    Create a new race lobby.

    The host provides a verse reference and the server fetches the text.
    Returns the lobby ID and join code.
    """
    # Fetch the verse text
    version = body.version.upper()
    if version not in VERSION_MAP:
        raise HTTPException(400, f"Unsupported version: {version}")

    try:
        async with httpx.AsyncClient() as client:
            cfg = VERSION_MAP[version]
            if cfg["provider"] == "bibleapi":
                trans = "kjv" if version == "KJV" else (cfg.get("id") or "kjv")
                verse_data = await fetch_bibleapi(client, body.verse_ref, trans)
            else:
                verse_data = await fetch_apibible(client, cfg["id"], body.verse_ref)
    except Exception as e:
        raise HTTPException(502, f"Could not fetch verse: {str(e)}")

    if not verse_data.get("text"):
        raise HTTPException(404, "Verse not found")

    # Create lobby
    lobby_id = secrets.token_hex(16)
    join_code = generate_join_code()

    # Ensure join code is unique
    while db.query(RaceLobby).filter(RaceLobby.join_code == join_code).first():
        join_code = generate_join_code()

    lobby = RaceLobby(
        id=lobby_id,
        join_code=join_code,
        host_id=user.id,
        verse_ref=verse_data.get("reference", body.verse_ref),
        verse_text=verse_data["text"],
        version=version,
        max_players=body.max_players
    )
    db.add(lobby)

    # Add host as first player
    player = LobbyPlayer(lobby_id=lobby_id, user_id=user.id)
    db.add(player)

    db.commit()
    logger.info(f"Lobby created: {join_code} by {user.username}")

    return {
        "id": lobby_id,
        "join_code": join_code,
        "verse_ref": lobby.verse_ref,
        "verse_text": lobby.verse_text,
        "max_players": lobby.max_players
    }


@app.get("/lobbies/{lobby_id}")
async def get_lobby(
    lobby_id: str,
    db: DBSession = Depends(get_db)
):
    """Get lobby details including player list."""
    lobby = db.query(RaceLobby).filter(RaceLobby.id == lobby_id).first()
    if not lobby:
        raise HTTPException(404, "Lobby not found")

    host = db.query(User).filter(User.id == lobby.host_id).first()

    # Get players with their usernames
    players_query = db.query(LobbyPlayer, User.username, User.avatar_id)\
        .join(User, LobbyPlayer.user_id == User.id)\
        .filter(LobbyPlayer.lobby_id == lobby_id)\
        .all()

    players = [
        {
            "user_id": p[0].user_id,
            "username": p[1],
            "avatar_id": p[2],
            "ready": p[0].ready,
            "progress": p[0].progress,
            "finished": p[0].finished,
            "finish_time": p[0].finish_time,
            "wpm": p[0].wpm,
            "place": p[0].place
        }
        for p in players_query
    ]

    return {
        "id": lobby.id,
        "join_code": lobby.join_code,
        "host_id": lobby.host_id,
        "host_username": host.username if host else "Unknown",
        "verse_ref": lobby.verse_ref,
        "verse_text": lobby.verse_text,
        "version": lobby.version,
        "status": lobby.status,
        "max_players": lobby.max_players,
        "players": players,
        "created_at": lobby.created_at.isoformat(),
        "started_at": lobby.started_at.isoformat() if lobby.started_at else None
    }


@app.post("/lobbies/join/{join_code}")
async def join_lobby_by_code(
    join_code: str,
    user: User = Depends(require_auth),
    db: DBSession = Depends(get_db)
):
    """Join a lobby using its join code."""
    lobby = db.query(RaceLobby).filter(
        RaceLobby.join_code == join_code.upper()
    ).first()

    if not lobby:
        raise HTTPException(404, "Lobby not found")

    if lobby.status != "waiting":
        raise HTTPException(400, "Lobby is not accepting players")

    # Check if already in lobby
    existing = db.query(LobbyPlayer).filter(
        LobbyPlayer.lobby_id == lobby.id,
        LobbyPlayer.user_id == user.id
    ).first()

    if existing:
        return {"id": lobby.id, "message": "Already in lobby"}

    # Check if lobby is full
    player_count = db.query(LobbyPlayer).filter(
        LobbyPlayer.lobby_id == lobby.id
    ).count()

    if player_count >= lobby.max_players:
        raise HTTPException(400, "Lobby is full")

    # Add player
    player = LobbyPlayer(lobby_id=lobby.id, user_id=user.id)
    db.add(player)
    db.commit()

    logger.info(f"{user.username} joined lobby {join_code}")

    return {"id": lobby.id, "message": "Joined lobby"}


@app.post("/lobbies/{lobby_id}/leave")
async def leave_lobby(
    lobby_id: str,
    user: User = Depends(require_auth),
    db: DBSession = Depends(get_db)
):
    """Leave a lobby."""
    db.query(LobbyPlayer).filter(
        LobbyPlayer.lobby_id == lobby_id,
        LobbyPlayer.user_id == user.id
    ).delete()

    # If host left and lobby is waiting, delete the lobby
    lobby = db.query(RaceLobby).filter(RaceLobby.id == lobby_id).first()
    if lobby and lobby.host_id == user.id and lobby.status == "waiting":
        db.query(LobbyPlayer).filter(LobbyPlayer.lobby_id == lobby_id).delete()
        db.query(RaceLobby).filter(RaceLobby.id == lobby_id).delete()

    db.commit()
    return {"ok": True}


@app.post("/lobbies/{lobby_id}/ready")
async def toggle_ready(
    lobby_id: str,
    user: User = Depends(require_auth),
    db: DBSession = Depends(get_db)
):
    """Toggle ready status in a lobby."""
    player = db.query(LobbyPlayer).filter(
        LobbyPlayer.lobby_id == lobby_id,
        LobbyPlayer.user_id == user.id
    ).first()

    if not player:
        raise HTTPException(404, "Not in lobby")

    player.ready = not player.ready
    db.commit()

    return {"ready": player.ready}


# ==============================================
# WEBSOCKET FOR REAL-TIME RACING
# ==============================================

@app.websocket("/ws/race/{lobby_id}")
async def websocket_race(
    websocket: WebSocket,
    lobby_id: str,
    token: str = Query(...),
    db: DBSession = Depends(get_db)
):
    """
    WebSocket endpoint for real-time race synchronization.

    Connect with: ws://host/ws/race/{lobby_id}?token={auth_token}

    Message types (client → server):
    - {"type": "ready"}
    - {"type": "progress", "chars": 45, "wpm": 62}
    - {"type": "finished", "time": 15.2, "wpm": 72, "accuracy": 98}

    Message types (server → client):
    - {"type": "player_joined", ...}
    - {"type": "player_left", ...}
    - {"type": "player_ready", ...}
    - {"type": "countdown", "seconds": 3}
    - {"type": "race_start", "verse_text": "...", "start_time": ...}
    - {"type": "progress", "user_id": "...", "chars": 45, "wpm": 62}
    - {"type": "player_finished", ...}
    - {"type": "race_end", "results": [...]}
    """
    # Authenticate
    session = db.query(UserSession).filter(
        UserSession.token == token,
        UserSession.expires_at > datetime.utcnow()
    ).first()

    if not session:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        await websocket.close(code=4001, reason="User not found")
        return

    # Check lobby exists
    lobby = db.query(RaceLobby).filter(RaceLobby.id == lobby_id).first()
    if not lobby:
        await websocket.close(code=4004, reason="Lobby not found")
        return

    # Check user is in lobby
    player = db.query(LobbyPlayer).filter(
        LobbyPlayer.lobby_id == lobby_id,
        LobbyPlayer.user_id == user.id
    ).first()

    if not player:
        await websocket.close(code=4003, reason="Not in lobby")
        return

    # Connect
    await ws_manager.connect(lobby_id, user.id, websocket)

    # Notify others
    await ws_manager.broadcast_to_lobby(lobby_id, {
        "type": "player_joined",
        "user_id": user.id,
        "username": user.username,
        "avatar_id": user.avatar_id
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ready":
                # Toggle ready status
                player.ready = not player.ready
                db.commit()

                await ws_manager.broadcast_to_lobby(lobby_id, {
                    "type": "player_ready",
                    "user_id": user.id,
                    "ready": player.ready
                })

                # Check if all players ready
                all_players = db.query(LobbyPlayer).filter(
                    LobbyPlayer.lobby_id == lobby_id
                ).all()

                if len(all_players) >= 2 and all(p.ready for p in all_players):
                    # Start countdown
                    lobby.status = "countdown"
                    db.commit()

                    # Countdown 3, 2, 1
                    for i in [3, 2, 1]:
                        await ws_manager.broadcast_to_lobby(lobby_id, {
                            "type": "countdown",
                            "seconds": i
                        })
                        await asyncio.sleep(1)

                    # Start race
                    lobby.status = "racing"
                    lobby.started_at = datetime.utcnow()
                    db.commit()

                    await ws_manager.broadcast_to_lobby(lobby_id, {
                        "type": "race_start",
                        "verse_text": lobby.verse_text,
                        "start_time": time.time() * 1000
                    })

            elif msg_type == "progress":
                # Update and broadcast progress
                chars = data.get("chars", 0)
                wpm = data.get("wpm", 0)

                player.progress = chars
                db.commit()

                ws_manager.update_player_state(lobby_id, user.id, progress=chars, wpm=wpm)

                await ws_manager.broadcast_to_lobby(lobby_id, {
                    "type": "progress",
                    "user_id": user.id,
                    "chars": chars,
                    "wpm": wpm
                })

            elif msg_type == "finished":
                # Player finished race
                finish_time = data.get("time", 0)
                wpm = data.get("wpm", 0)
                accuracy = data.get("accuracy", 0)

                # Calculate place
                finished_count = db.query(LobbyPlayer).filter(
                    LobbyPlayer.lobby_id == lobby_id,
                    LobbyPlayer.finished == True
                ).count()

                place = finished_count + 1

                player.finished = True
                player.finish_time = finish_time
                player.wpm = wpm
                player.place = place

                # Update user stats
                user.total_races += 1
                if place == 1:
                    user.races_won += 1
                if wpm > user.best_wpm:
                    user.best_wpm = wpm

                db.commit()

                ws_manager.update_player_state(
                    lobby_id, user.id,
                    finished=True, finish_time=finish_time, wpm=wpm, place=place
                )

                await ws_manager.broadcast_to_lobby(lobby_id, {
                    "type": "player_finished",
                    "user_id": user.id,
                    "username": user.username,
                    "place": place,
                    "time": finish_time,
                    "wpm": wpm,
                    "accuracy": accuracy
                })

                # Check if all finished
                all_players = db.query(LobbyPlayer).filter(
                    LobbyPlayer.lobby_id == lobby_id
                ).all()

                all_finished = all(p.finished for p in all_players)

                if all_finished:
                    lobby.status = "finished"
                    lobby.finished_at = datetime.utcnow()
                    db.commit()

                    # Send final results
                    results = sorted(all_players, key=lambda p: p.place or 999)
                    await ws_manager.broadcast_to_lobby(lobby_id, {
                        "type": "race_end",
                        "results": [
                            {
                                "user_id": p.user_id,
                                "place": p.place,
                                "time": p.finish_time,
                                "wpm": p.wpm
                            }
                            for p in results
                        ]
                    })

            elif msg_type == "rematch":
                # Broadcast new lobby code so other players can auto-join
                new_join_code = data.get("join_code", "")
                if new_join_code:
                    await ws_manager.broadcast_to_lobby(lobby_id, {
                        "type": "rematch",
                        "join_code": new_join_code,
                        "user_id": user.id,
                        "username": user.username
                    })

    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(lobby_id, user.id)
        await ws_manager.broadcast_to_lobby(lobby_id, {
            "type": "player_left",
            "user_id": user.id,
            "username": user.username
        })

# ---------- Serve static frontend files ----------
# Mount LAST so API routes take priority over file paths
STATIC_DIR = Path(__file__).resolve().parent
logger.info(f"Serving static files from: {STATIC_DIR}")
logger.info(f"lobby.html exists: {(STATIC_DIR / 'lobby.html').exists()}")
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
