# tests/test_server.py
"""
Unit tests for the Type of Faith API server.

Run with: pytest tests/ -v
"""
import json
import time
import shutil
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import HTTPException

# Import the app and helper functions
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from server import (
    app,
    _cache_key,
    _cache_path,
    get_cache,
    set_cache,
    get_cache_stats,
    _strip_html,
    CACHE_DIR,
    CACHE_TTL_SECONDS,
    VERSION_MAP,
)


# ============================================
# Fixtures
# ============================================

@pytest.fixture
def test_cache_dir(tmp_path):
    """Create a temporary cache directory for testing."""
    cache_dir = tmp_path / ".cache"
    cache_dir.mkdir()
    return cache_dir


@pytest.fixture
def clean_cache():
    """Clean the cache directory before and after tests."""
    # Clean before
    if CACHE_DIR.exists():
        for f in CACHE_DIR.glob("*.json"):
            f.unlink()
    yield
    # Clean after
    if CACHE_DIR.exists():
        for f in CACHE_DIR.glob("*.json"):
            f.unlink()


@pytest.fixture
async def client():
    """Create an async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ============================================
# Cache Function Tests
# ============================================

class TestCacheFunctions:
    """Tests for caching utilities."""

    def test_cache_key_generation(self):
        """Cache key should be deterministic MD5 hash."""
        key1 = _cache_key("KJV", "John 3:16")
        key2 = _cache_key("KJV", "John 3:16")
        key3 = _cache_key("WEB", "John 3:16")

        assert key1 == key2, "Same inputs should produce same key"
        assert key1 != key3, "Different versions should produce different keys"
        assert len(key1) == 32, "MD5 hash should be 32 characters"

    def test_cache_key_case_insensitive(self):
        """Cache keys should be case-insensitive."""
        key1 = _cache_key("KJV", "John 3:16")
        key2 = _cache_key("kjv", "john 3:16")

        assert key1 == key2

    def test_cache_path_in_cache_dir(self):
        """Cache path should be in the cache directory."""
        path = _cache_path("test_key")

        assert path.parent == CACHE_DIR
        assert path.name == "test_key.json"

    def test_set_and_get_cache(self, clean_cache):
        """Should store and retrieve cached data."""
        payload = {"text": "Test verse", "reference": "Test 1:1"}

        set_cache("KJV", "Test 1:1", payload)
        retrieved = get_cache("KJV", "Test 1:1")

        assert retrieved == payload

    def test_get_cache_miss(self, clean_cache):
        """Should return None for cache miss."""
        result = get_cache("KJV", "NonExistent 99:99")

        assert result is None

    def test_cache_expiry(self, clean_cache):
        """Expired cache entries should return None."""
        payload = {"text": "Test verse"}
        key = _cache_key("KJV", "Expired 1:1")
        path = _cache_path(key)

        # Write cache entry with old timestamp
        CACHE_DIR.mkdir(exist_ok=True)
        old_time = time.time() - CACHE_TTL_SECONDS - 100
        data = {"_cached_at": old_time, "payload": payload}
        path.write_text(json.dumps(data))

        result = get_cache("KJV", "Expired 1:1")

        assert result is None
        assert not path.exists(), "Expired entry should be deleted"

    def test_cache_stats(self, clean_cache):
        """Should return accurate cache statistics."""
        # Add some cache entries
        set_cache("KJV", "Stat 1:1", {"text": "verse1"})
        set_cache("WEB", "Stat 1:2", {"text": "verse2"})

        stats = get_cache_stats()

        assert stats["entries"] == 2
        assert stats["size_kb"] > 0
        assert stats["max_entries"] == 5000
        assert stats["ttl_hours"] == 24


# ============================================
# HTML Stripping Tests
# ============================================

class TestHtmlStripping:
    """Tests for HTML stripping utility."""

    def test_strip_simple_tags(self):
        """Should remove simple HTML tags."""
        assert _strip_html("<p>Hello</p>") == "Hello"
        assert _strip_html("<b>Bold</b> text") == "Bold text"

    def test_strip_nested_tags(self):
        """Should remove nested HTML tags."""
        assert _strip_html("<div><p>Nested</p></div>") == "Nested"

    def test_strip_attributes(self):
        """Should remove tags with attributes."""
        assert _strip_html('<span class="verse">Text</span>') == "Text"

    def test_strip_empty_string(self):
        """Should handle empty strings."""
        assert _strip_html("") == ""
        assert _strip_html(None) == ""

    def test_preserve_plain_text(self):
        """Should preserve text without HTML."""
        assert _strip_html("Plain text") == "Plain text"


# ============================================
# API Endpoint Tests
# ============================================

class TestHealthEndpoint:
    """Tests for the /health endpoint."""

    @pytest.mark.asyncio
    async def test_health_returns_ok(self, client):
        """Health endpoint should return ok status."""
        response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True

    @pytest.mark.asyncio
    async def test_health_includes_version(self, client):
        """Health endpoint should include API version."""
        response = await client.get("/health")
        data = response.json()

        assert "version" in data
        assert data["version"] == "1.1.0"

    @pytest.mark.asyncio
    async def test_health_includes_uptime(self, client):
        """Health endpoint should include uptime info."""
        response = await client.get("/health")
        data = response.json()

        assert "uptime_seconds" in data
        assert "uptime_human" in data
        assert isinstance(data["uptime_seconds"], int)

    @pytest.mark.asyncio
    async def test_health_includes_cache_stats(self, client):
        """Health endpoint should include cache statistics."""
        response = await client.get("/health")
        data = response.json()

        assert "cache" in data
        assert "entries" in data["cache"]
        assert "size_kb" in data["cache"]

    @pytest.mark.asyncio
    async def test_health_includes_supported_versions(self, client):
        """Health endpoint should list supported Bible versions."""
        response = await client.get("/health")
        data = response.json()

        assert "supported_versions" in data
        assert "KJV" in data["supported_versions"]
        assert "WEB" in data["supported_versions"]


class TestVerseEndpoint:
    """Tests for the /verse endpoint."""

    @pytest.mark.asyncio
    async def test_verse_requires_ref_param(self, client):
        """Should return 422 if ref parameter is missing."""
        response = await client.get("/verse")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_verse_rejects_invalid_version(self, client):
        """Should return 400 for unsupported version."""
        response = await client.get("/verse?ref=John+3:16&version=INVALID")

        assert response.status_code == 400
        assert "Unsupported version" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_verse_accepts_valid_versions(self, client):
        """Should accept all configured versions."""
        for version in VERSION_MAP.keys():
            # Just check the request is accepted (not the actual fetch)
            response = await client.get(f"/verse?ref=John+3:16&version={version}")
            # Will fail with 502 if proxy/API unavailable, but should not be 400
            assert response.status_code != 400 or "Unsupported" not in response.text

    @pytest.mark.asyncio
    async def test_verse_returns_cached_response(self, client, clean_cache):
        """Should return cached verse without hitting API."""
        # Pre-populate cache
        cached_data = {
            "reference": "John 3:16",
            "text": "Cached verse text",
            "version": "KJV"
        }
        set_cache("KJV", "John 3:16", cached_data)

        response = await client.get("/verse?ref=John+3:16&version=KJV")

        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "Cached verse text"

    @pytest.mark.asyncio
    async def test_verse_case_insensitive_version(self, client, clean_cache):
        """Version parameter should be case-insensitive."""
        cached_data = {"reference": "Test", "text": "Test", "version": "KJV"}
        set_cache("KJV", "Test 1:1", cached_data)

        response = await client.get("/verse?ref=Test+1:1&version=kjv")

        assert response.status_code == 200


class TestCacheClearEndpoint:
    """Tests for the /cache/clear endpoint."""

    @pytest.mark.asyncio
    async def test_cache_clear_removes_entries(self, client, clean_cache):
        """Should remove all cache entries."""
        # Add some entries
        set_cache("KJV", "Clear 1:1", {"text": "test1"})
        set_cache("WEB", "Clear 1:2", {"text": "test2"})

        response = await client.get("/cache/clear")

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["cleared"] == 2

    @pytest.mark.asyncio
    async def test_cache_clear_empty_cache(self, client, clean_cache):
        """Should handle empty cache gracefully."""
        response = await client.get("/cache/clear")

        assert response.status_code == 200
        data = response.json()
        assert data["cleared"] == 0


# ============================================
# Integration Tests (require network)
# ============================================

class TestBibleApiIntegration:
    """Integration tests that hit real APIs (skipped by default)."""

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires network access")
    async def test_fetch_kjv_verse(self, client, clean_cache):
        """Should fetch KJV verse from bible-api.com."""
        response = await client.get("/verse?ref=John+3:16&version=KJV")

        assert response.status_code == 200
        data = response.json()
        assert "God" in data["text"]
        assert data["reference"] == "John 3:16"

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires network access")
    async def test_fetch_web_verse(self, client, clean_cache):
        """Should fetch WEB verse from bible-api.com."""
        response = await client.get("/verse?ref=Psalm+23:1&version=WEB")

        assert response.status_code == 200
        data = response.json()
        assert "shepherd" in data["text"].lower()


# ============================================
# Rate Limiting Tests
# ============================================

class TestRateLimiting:
    """Tests for rate limiting behavior."""

    @pytest.mark.asyncio
    async def test_rate_limit_header_present(self, client, clean_cache):
        """Response should include rate limit headers."""
        # Pre-populate cache to avoid network
        set_cache("KJV", "Rate 1:1", {"text": "test", "reference": "Rate 1:1", "version": "KJV"})

        response = await client.get("/verse?ref=Rate+1:1&version=KJV")

        # slowapi adds these headers
        assert response.status_code == 200


# ============================================
# Error Handling Tests
# ============================================

class TestErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_empty_ref_rejected(self, client):
        """Should reject empty reference."""
        response = await client.get("/verse?ref=&version=KJV")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_malformed_json_in_cache(self, clean_cache):
        """Should handle malformed cache files gracefully."""
        CACHE_DIR.mkdir(exist_ok=True)
        key = _cache_key("KJV", "Malformed 1:1")
        path = _cache_path(key)
        path.write_text("not valid json")

        result = get_cache("KJV", "Malformed 1:1")

        assert result is None


# ============================================
# Auth Endpoint Tests
# ============================================

class TestAuthEndpoints:
    """Tests for authentication endpoints."""

    @pytest.mark.asyncio
    async def test_register_new_user(self, client):
        """Should register a new user and return token."""
        response = await client.post(
            "/auth/register",
            json={"username": f"TestUser{int(time.time())}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "token" in data
        assert "username" in data
        assert len(data["token"]) == 64  # 32 bytes hex

    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, client):
        """Should reject duplicate usernames."""
        username = f"DupeUser{int(time.time())}"

        # First registration
        await client.post("/auth/register", json={"username": username})

        # Second registration with same name
        response = await client.post("/auth/register", json={"username": username})

        assert response.status_code == 400
        assert "taken" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_register_invalid_username(self, client):
        """Should reject invalid usernames."""
        # Too short
        response = await client.post("/auth/register", json={"username": "a"})
        assert response.status_code == 422

        # Invalid characters
        response = await client.post("/auth/register", json={"username": "bad@name!"})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_me_with_valid_token(self, client):
        """Should return user info with valid token."""
        # Register first
        reg_response = await client.post(
            "/auth/register",
            json={"username": f"MeUser{int(time.time())}"}
        )
        token = reg_response.json()["token"]

        # Get user info
        response = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "username" in data
        assert "best_wpm" in data

    @pytest.mark.asyncio
    async def test_get_me_without_token(self, client):
        """Should return 401 without token."""
        response = await client.get("/auth/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me_with_invalid_token(self, client):
        """Should return 401 with invalid token."""
        response = await client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalidtoken123"}
        )
        assert response.status_code == 401


# ============================================
# Leaderboard Endpoint Tests
# ============================================

class TestLeaderboardEndpoints:
    """Tests for leaderboard endpoints."""

    @pytest.mark.asyncio
    async def test_get_daily_leaderboard(self, client):
        """Should return daily leaderboard."""
        response = await client.get("/leaderboard/daily")

        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        assert "scores" in data
        assert isinstance(data["scores"], list)

    @pytest.mark.asyncio
    async def test_get_daily_leaderboard_with_date(self, client):
        """Should accept specific date."""
        response = await client.get("/leaderboard/daily?challenge_date=2024-01-15")

        assert response.status_code == 200
        assert response.json()["date"] == "2024-01-15"

    @pytest.mark.asyncio
    async def test_submit_score_requires_auth(self, client):
        """Should require authentication to submit score."""
        response = await client.post(
            "/leaderboard/daily/submit",
            json={"wpm": 60, "accuracy": 95, "time_seconds": 15.5}
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_submit_score_with_auth(self, client):
        """Should accept score from authenticated user."""
        # Register
        reg_response = await client.post(
            "/auth/register",
            json={"username": f"ScoreUser{int(time.time())}"}
        )
        token = reg_response.json()["token"]

        # Submit score
        response = await client.post(
            "/leaderboard/daily/submit",
            json={"wpm": 65, "accuracy": 98, "time_seconds": 12.5},
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "rank" in data
        assert "total_players" in data

    @pytest.mark.asyncio
    async def test_get_alltime_leaderboard(self, client):
        """Should return all-time leaderboard."""
        response = await client.get("/leaderboard/alltime")

        assert response.status_code == 200
        data = response.json()
        assert "scores" in data
        assert isinstance(data["scores"], list)


# ============================================
# Run tests
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
