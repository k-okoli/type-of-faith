// shared/shortcuts.js — Keyboard shortcut help modal
(function () {
  const globalShortcuts = [
    { keys: "?", desc: "Show keyboard shortcuts" },
    { keys: "Ctrl+J", desc: "Cycle theme (Auto/Light/Dark)" }
  ];
  let pageShortcuts = [];
  let modalOpen = false;

  function injectStyles() {
    if (document.getElementById("tof-shortcuts-styles")) return;
    const style = document.createElement("style");
    style.id = "tof-shortcuts-styles";
    style.textContent = `
      #tof-shortcuts-modal {
        position: fixed; inset: 0; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
      }
      .tof-sc-backdrop {
        position: absolute; inset: 0; background: rgba(0,0,0,0.6);
      }
      .tof-sc-content {
        position: relative; background: var(--panel, #fff); color: var(--ink, #111);
        border-radius: 12px; padding: 24px; max-width: 420px; width: 90%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3); max-height: 80vh; overflow-y: auto;
      }
      .tof-sc-content h3 { margin: 0 0 16px; font-size: 18px; }
      .tof-sc-section { margin-bottom: 16px; }
      .tof-sc-section h4 {
        font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
        color: var(--muted, #666); margin: 0 0 8px; font-weight: 600;
      }
      .tof-sc-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px 0; font-size: 14px;
      }
      .tof-sc-row + .tof-sc-row { border-top: 1px solid var(--border, #eee); }
      .tof-sc-key {
        display: inline-block; background: var(--bg, #f5f5f5); border: 1px solid var(--border, #ddd);
        border-radius: 4px; padding: 2px 8px; font-family: monospace; font-size: 13px;
        font-weight: 600; white-space: nowrap;
      }
      .tof-sc-close {
        position: absolute; top: 12px; right: 12px; background: none; border: none;
        font-size: 20px; cursor: pointer; color: var(--muted, #666); line-height: 1; padding: 4px;
      }
      .tof-sc-close:hover { color: var(--ink, #111); }
    `;
    document.head.appendChild(style);
  }

  function registerShortcuts(shortcuts) {
    pageShortcuts = shortcuts;
  }

  function buildRows(items) {
    return items.map(s =>
      `<div class="tof-sc-row"><span>${s.desc}</span><span class="tof-sc-key">${s.keys}</span></div>`
    ).join("");
  }

  function showShortcutsModal() {
    if (modalOpen) { closeModal(); return; }
    injectStyles();

    const existing = document.getElementById("tof-shortcuts-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "tof-shortcuts-modal";

    let html = `
      <div class="tof-sc-backdrop"></div>
      <div class="tof-sc-content">
        <button class="tof-sc-close" title="Close">&times;</button>
        <h3>Keyboard Shortcuts</h3>
        <div class="tof-sc-section">
          <h4>Global</h4>
          ${buildRows(globalShortcuts)}
        </div>
    `;

    if (pageShortcuts.length > 0) {
      html += `
        <div class="tof-sc-section">
          <h4>This Page</h4>
          ${buildRows(pageShortcuts)}
        </div>
      `;
    }

    html += `</div>`;
    modal.innerHTML = html;

    modal.querySelector(".tof-sc-backdrop").addEventListener("click", closeModal);
    modal.querySelector(".tof-sc-close").addEventListener("click", closeModal);

    document.body.appendChild(modal);
    modalOpen = true;
  }

  function closeModal() {
    const modal = document.getElementById("tof-shortcuts-modal");
    if (modal) modal.remove();
    modalOpen = false;
  }

  function isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
  }

  // Global key listener
  document.addEventListener("keydown", (e) => {
    // Escape closes modal
    if (e.key === "Escape" && modalOpen) {
      closeModal();
      return;
    }

    // ? key or Ctrl+/ — skip when typing
    if (isTyping()) return;

    if (e.key === "?" || (e.ctrlKey && e.key === "/")) {
      e.preventDefault();
      showShortcutsModal();
    }
  });

  window.TofShortcuts = {
    registerShortcuts,
    showShortcutsModal
  };
})();
