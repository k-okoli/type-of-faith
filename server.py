# server.py
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
import os, re, requests
from typing import Optional

app = FastAPI()

# ---------- Config ----------
API_BIBLE_KEY = os.getenv("API_BIBLE_KEY")
API_BIBLE_BASE = "https://api.scripture.api.bible/v1"

# Map UI "version" codes to provider + id.
VERSION_MAP = {
    "KJV": {"provider": "bibleapi", "id": None},                   # bible-api.com
    "WEB": {"provider": "bibleapi", "id": "web"},                  # bible-api.com
    "FBV": {"provider": "apibible", "id": "65eec8e0b60e656b-01"},  # Free Bible Version (you confirmed this works)
    "ICV": {"provider": "apibible", "id": "a36fc06b086699f1-02"},  # Igbo Contemporary Bible Version
    "YCV": {"provider": "apibible", "id": "b8d1feac6e94bd74-01"},  # Yoruba Contemporary Bible Version
    # Add more api.bible versions here once you confirm access and have the bibleId
}

OSIS_RE = re.compile(r"^[A-Z0-9]{3}\.\d+(\.\d+)?$", re.IGNORECASE)


# ---------- Enable CORS (Browser Security) ----------
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*","null","http://localhost:5500","http://127.0.0.1:5500","http://localhost:5173","http://127.0.0.1:5173","http://localhost:3000","http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- tiny cache ----------
_cache = {}
def _ck(v, r): return f"{v}|{r}".lower().strip()
def get_cache(v, r): return _cache.get(_ck(v, r))
def set_cache(v, r, data): _cache[_ck(v, r)] = data

# ---------- api.bible helpers ----------
def _strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "")

def apibible_search_resolve_osis(bible_id: str, ref: str) -> str:
    """Resolve 'John 3:16' -> 'JHN.3.16' using /search."""
    if not API_BIBLE_KEY:
        raise HTTPException(status_code=500, detail="Server missing API_BIBLE_KEY")
    headers = {"api-key": API_BIBLE_KEY}
    url = f"{API_BIBLE_BASE}/bibles/{bible_id}/search"
    params = {"query": ref, "limit": 1}
    r = requests.get(url, headers=headers, params=params, timeout=12)
    if r.status_code == 401:
        raise HTTPException(status_code=500, detail=f"API Bible key invalid: {r.text}")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"api.bible search error {r.status_code}: {r.text}")
    data = r.json().get("data") or {}
    verses = data.get("verses") or []
    if verses and verses[0].get("id"):
        return verses[0]["id"]
    passages = data.get("passages") or []
    if passages and passages[0].get("id"):
        return passages[0]["id"]
    raise HTTPException(status_code=404, detail=f"No OSIS id found for reference: {ref}")

def apibible_fetch_passage_by_osis(bible_id: str, osis: str) -> dict:
    """Call /passages/{OSIS} with hyphenated params (HTML), then strip to plain text."""
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
    r = requests.get(url, headers=headers, params=params, timeout=12)
    if r.status_code == 401:
        raise HTTPException(status_code=500, detail=f"API Bible key invalid: {r.text}")
    if r.status_code == 403:
        raise HTTPException(status_code=403, detail=f"Bible unauthorized for this key: {r.text}")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"api.bible error {r.status_code}: {r.text}")
    d = r.json().get("data", {})
    reference = d.get("reference", osis)
    html = d.get("content") or ""
    text = " ".join(_strip_html(html).split())
    out = {"reference": reference, "text": text}
    if d.get("copyright"):
        out["copyright"] = d["copyright"]
    return out

def fetch_apibible(bible_id: str, ref: str) -> dict:
    """If ref is OSIS, fetch directly; else /search -> OSIS -> /passages/{OSIS}."""
    osis = ref if OSIS_RE.match(ref) else apibible_search_resolve_osis(bible_id, ref)
    return apibible_fetch_passage_by_osis(bible_id, osis)

# ---------- bible-api.com (KJV/WEB) ----------
def fetch_bibleapi(ref: str, trans: Optional[str] = None) -> dict:
    url = f"https://bible-api.com/{ref}"
    params = {}
    if trans and trans.lower() != "kjv":
        params["translation"] = trans.lower()
    r = requests.get(url, params=params, timeout=12)
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

# ---------- API ----------
@app.get("/health")
def health():
    return {"ok": True}

@app.get("/verse")
def get_verse(ref: str = Query(..., min_length=1), version: str = Query("KJV")):
    """
    Query:
      - ref: 'John 3:16' (human) or 'JHN.3.16' (OSIS)
      - version: KJV, WEB (bible-api.com) or FBV/... (api.bible)
    """
    version = version.upper().strip()
    if version not in VERSION_MAP:
        raise HTTPException(status_code=400, detail=f"Unsupported version: {version}")

    cached = get_cache(version, ref)
    if cached:
        return JSONResponse(cached)

    cfg = VERSION_MAP[version]
    provider = cfg["provider"]

    if provider == "bibleapi":
        trans = "kjv" if version == "KJV" else (cfg.get("id") or "kjv")
        out = fetch_bibleapi(ref, trans)
    elif provider == "apibible":
        bible_id = cfg.get("id")
        if not bible_id:
            raise HTTPException(status_code=400, detail=f"No bibleId configured for version {version}")
        base = fetch_apibible(bible_id, ref)
        out = {"reference": base["reference"], "text": base["text"], "version": version}
        if base.get("copyright"):
            out["copyright"] = base["copyright"]
    else:
        raise HTTPException(status_code=500, detail=f"Bad provider: {provider}")

    if not out.get("text"):
        raise HTTPException(status_code=404, detail=f"No verse text found for {version} {ref}")

    set_cache(version, ref, out)
    return JSONResponse(out)
