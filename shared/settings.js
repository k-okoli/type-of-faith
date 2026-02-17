// shared/settings.js — Centralized settings panel
(function () {
  let modalOpen = false;

  function injectStyles() {
    if (document.getElementById("tof-settings-styles")) return;
    const style = document.createElement("style");
    style.id = "tof-settings-styles";
    style.textContent = `
      #tof-settings-modal {
        position: fixed; inset: 0; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
      }
      .tof-set-backdrop {
        position: absolute; inset: 0; background: rgba(0,0,0,0.6);
      }
      .tof-set-content {
        position: relative; background: var(--panel, #fff); color: var(--ink, #111);
        border-radius: 12px; padding: 24px; max-width: 480px; width: 92%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-height: 85vh; overflow-y: auto;
      }
      .tof-set-content h3 { margin: 0 0 20px; font-size: 18px; }
      .tof-set-close {
        position: absolute; top: 12px; right: 12px; background: none; border: none;
        font-size: 20px; cursor: pointer; color: var(--muted, #666); line-height: 1; padding: 4px;
      }
      .tof-set-close:hover { color: var(--ink, #111); }
      .tof-set-section { margin-bottom: 20px; }
      .tof-set-section h4 {
        font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em;
        color: var(--muted, #666); margin: 0 0 10px; font-weight: 600;
      }
      .tof-set-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 0; font-size: 14px;
      }
      .tof-set-row + .tof-set-row { border-top: 1px solid var(--border, #eee); }
      .tof-set-row label { flex: 1; }
      .tof-set-row select, .tof-set-row input[type="number"] {
        font-size: 14px; padding: 4px 8px; border-radius: 6px;
        border: 1px solid var(--border, #ddd); background: var(--bg, #f5f5f5);
        color: var(--ink, #111); width: 100px;
      }
      .tof-set-toggle {
        position: relative; width: 44px; height: 24px; cursor: pointer;
        background: var(--border, #ccc); border-radius: 12px; border: none;
        transition: background 0.2s;
      }
      .tof-set-toggle.on { background: var(--ok, #0a7a0a); }
      .tof-set-toggle::after {
        content: ""; position: absolute; top: 2px; left: 2px;
        width: 20px; height: 20px; border-radius: 50%;
        background: #fff; transition: transform 0.2s;
      }
      .tof-set-toggle.on::after { transform: translateX(20px); }
      .tof-set-avatars {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
        gap: 10px; margin-top: 8px;
      }
      .tof-set-avatar {
        display: flex; flex-direction: column; align-items: center; gap: 4px;
        cursor: pointer; padding: 8px 4px; border-radius: 8px; border: 2px solid transparent;
        transition: border-color 0.15s, opacity 0.15s;
      }
      .tof-set-avatar:hover { border-color: var(--border, #ddd); }
      .tof-set-avatar.selected { border-color: var(--accent, #8b6b3b); }
      .tof-set-avatar.locked { opacity: 0.4; cursor: not-allowed; }
      .tof-set-avatar img { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
      .tof-set-avatar span { font-size: 11px; text-align: center; color: var(--muted, #666); }
      .tof-set-danger {
        background: color-mix(in srgb, var(--err, #b00020) 10%, var(--panel, #fff));
        border: 1px solid color-mix(in srgb, var(--err, #b00020) 30%, transparent);
        color: var(--err, #b00020); font-size: 14px; font-weight: 600;
        padding: 10px 20px; border-radius: 6px; cursor: pointer; width: 100%;
      }
      .tof-set-danger:hover { background: color-mix(in srgb, var(--err, #b00020) 20%, var(--panel, #fff)); }
    `;
    document.head.appendChild(style);
  }

  function show() {
    if (modalOpen) { close(); return; }
    injectStyles();

    const existing = document.getElementById("tof-settings-modal");
    if (existing) existing.remove();

    const currentTheme = localStorage.getItem("tof_theme") || "auto";
    const isMuted = typeof TofAudio !== "undefined" && TofAudio.isMuted();
    const previewSec = localStorage.getItem("tof_preview_sec") || "5";
    const peekSec = localStorage.getItem("tof_peek_sec") || "3";
    const currentAvatar = localStorage.getItem("tof_avatar") || "moses";

    // Build avatar grid
    let avatarHTML = "";
    if (typeof TofAchievements !== "undefined") {
      const avatars = TofAchievements.getAllAvatarsWithStatus();
      for (const av of avatars) {
        const sel = av.id === currentAvatar ? "selected" : "";
        const locked = av.unlocked ? "" : "locked";
        const title = av.unlocked ? av.name : `${av.name} — ${av.description}`;
        avatarHTML += `
          <div class="tof-set-avatar ${sel} ${locked}" data-id="${av.id}" title="${title}">
            <img src="${av.src}" alt="${av.name}" />
            <span>${av.name}</span>
          </div>`;
      }
    }

    const modal = document.createElement("div");
    modal.id = "tof-settings-modal";
    modal.innerHTML = `
      <div class="tof-set-backdrop"></div>
      <div class="tof-set-content">
        <button class="tof-set-close" title="Close">&times;</button>
        <h3>Settings</h3>

        <div class="tof-set-section">
          <h4>Appearance</h4>
          <div class="tof-set-row">
            <label>Theme</label>
            <select id="tof-set-theme">
              <option value="auto"${currentTheme === "auto" ? " selected" : ""}>Auto</option>
              <option value="light"${currentTheme === "light" ? " selected" : ""}>Light</option>
              <option value="dark"${currentTheme === "dark" ? " selected" : ""}>Dark</option>
            </select>
          </div>
        </div>

        <div class="tof-set-section">
          <h4>Audio</h4>
          <div class="tof-set-row">
            <label>Sound Effects</label>
            <button class="tof-set-toggle${isMuted ? "" : " on"}" id="tof-set-sound"></button>
          </div>
        </div>

        <div class="tof-set-section">
          <h4>Blind Faith Timers</h4>
          <div class="tof-set-row">
            <label>Preview (seconds)</label>
            <input type="number" id="tof-set-preview" min="1" max="30" value="${previewSec}" />
          </div>
          <div class="tof-set-row">
            <label>Peek (seconds)</label>
            <input type="number" id="tof-set-peek" min="1" max="30" value="${peekSec}" />
          </div>
        </div>

        ${avatarHTML ? `
        <div class="tof-set-section">
          <h4>Avatar</h4>
          <div class="tof-set-avatars" id="tof-set-avatar-grid">${avatarHTML}</div>
        </div>
        ` : ""}

        <div class="tof-set-section">
          <h4>Data</h4>
          <button class="tof-set-danger" id="tof-set-clear">Clear All Data</button>
        </div>
      </div>
    `;

    // Events
    modal.querySelector(".tof-set-backdrop").addEventListener("click", close);
    modal.querySelector(".tof-set-close").addEventListener("click", close);

    // Theme
    modal.querySelector("#tof-set-theme").addEventListener("change", (e) => {
      if (typeof applyTheme === "function") applyTheme(e.target.value);
      // Sync nav select
      const navSel = document.getElementById("themeMode");
      if (navSel) navSel.value = e.target.value;
    });

    // Sound toggle
    modal.querySelector("#tof-set-sound").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      const isOn = btn.classList.contains("on");
      if (typeof TofAudio !== "undefined") TofAudio.setMuted(isOn);
      btn.classList.toggle("on", !isOn);
    });

    // Blind Faith timers
    modal.querySelector("#tof-set-preview").addEventListener("change", (e) => {
      const val = Math.max(1, Math.min(30, parseInt(e.target.value) || 5));
      localStorage.setItem("tof_preview_sec", val);
      e.target.value = val;
      // Sync practice.html input if present
      const pi = document.getElementById("previewSeconds");
      if (pi) pi.value = val;
    });
    modal.querySelector("#tof-set-peek").addEventListener("change", (e) => {
      const val = Math.max(1, Math.min(30, parseInt(e.target.value) || 3));
      localStorage.setItem("tof_peek_sec", val);
      e.target.value = val;
      const pi = document.getElementById("peekSeconds");
      if (pi) pi.value = val;
    });

    // Avatar selection
    const avatarGrid = modal.querySelector("#tof-set-avatar-grid");
    if (avatarGrid) {
      avatarGrid.addEventListener("click", (e) => {
        const card = e.target.closest(".tof-set-avatar");
        if (!card || card.classList.contains("locked")) return;
        const id = card.dataset.id;
        avatarGrid.querySelectorAll(".tof-set-avatar").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        localStorage.setItem("tof_avatar", id);
        document.dispatchEvent(new CustomEvent("tof-avatar-changed", { detail: { id } }));
      });
    }

    // Clear data
    modal.querySelector("#tof-set-clear").addEventListener("click", () => {
      if (!confirm("This will remove all Type of Faith data (stats, progress, settings). Continue?")) return;
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("tof_")) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
      location.reload();
    });

    // Escape to close
    const esc = (e) => {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    };
    document.addEventListener("keydown", esc);

    document.body.appendChild(modal);
    modalOpen = true;
  }

  function close() {
    const m = document.getElementById("tof-settings-modal");
    if (m) m.remove();
    modalOpen = false;
  }

  window.TofSettings = { show };
})();
