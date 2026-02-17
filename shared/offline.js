// shared/offline.js — Offline indicator with auto-ping and dismissible banner
(function () {
  const HEALTH_URL = "http://127.0.0.1:8000/health";
  const CHECK_INTERVAL = 60000; // 60s
  let offline = false;
  let intervalId = null;
  let dismissed = false;

  function injectStyles() {
    if (document.getElementById("tof-offline-styles")) return;
    const style = document.createElement("style");
    style.id = "tof-offline-styles";
    style.textContent = `
      #tof-offline-banner {
        display: none;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        background: color-mix(in srgb, var(--err, #b00020) 12%, var(--panel, #fff));
        border: 1px solid color-mix(in srgb, var(--err, #b00020) 30%, transparent);
        color: var(--ink, #111);
        font-size: 14px;
        margin: -24px -24px 12px -24px;
        border-radius: 0;
      }
      #tof-offline-banner.show { display: flex; }
      #tof-offline-banner .offline-icon { font-size: 16px; flex-shrink: 0; }
      #tof-offline-banner .offline-msg { flex: 1; }
      #tof-offline-banner .offline-dismiss {
        background: none; border: none; font-size: 18px; cursor: pointer;
        color: var(--muted, #555); padding: 0 4px; line-height: 1;
      }
      #tof-offline-banner .offline-dismiss:hover { color: var(--ink, #111); }
    `;
    document.head.appendChild(style);
  }

  function ensureBanner() {
    if (document.getElementById("tof-offline-banner")) return;
    injectStyles();
    const banner = document.createElement("div");
    banner.id = "tof-offline-banner";
    banner.innerHTML = `
      <span class="offline-icon">⚠️</span>
      <span class="offline-msg">Proxy offline. KJV/WEB will fall back to public provider. Start FastAPI for FBV/ESV and leaderboard.</span>
      <button class="offline-dismiss" title="Dismiss">&times;</button>
    `;
    banner.querySelector(".offline-dismiss").addEventListener("click", () => {
      dismissed = true;
      banner.classList.remove("show");
    });
    // Insert after nav
    const nav = document.querySelector(".tof-nav");
    if (nav && nav.nextSibling) {
      nav.parentNode.insertBefore(banner, nav.nextSibling);
    } else {
      document.body.prepend(banner);
    }
  }

  function showBanner() {
    ensureBanner();
    if (!dismissed) {
      document.getElementById("tof-offline-banner").classList.add("show");
    }
  }

  function hideBanner() {
    const b = document.getElementById("tof-offline-banner");
    if (b) b.classList.remove("show");
  }

  /**
   * Check health endpoint. Returns true if online.
   */
  async function checkHealth() {
    try {
      const res = await fetch(HEALTH_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("not ok");
      if (offline) {
        offline = false;
        hideBanner();
      }
      return true;
    } catch {
      offline = true;
      showBanner();
      return false;
    }
  }

  function isOffline() {
    return offline;
  }

  // Auto-check on load and every 60s
  function init() {
    checkHealth();
    intervalId = setInterval(checkHealth, CHECK_INTERVAL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.TofOffline = {
    isOffline,
    checkHealth
  };
})();
