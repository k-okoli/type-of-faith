// shared/welcome.js — First-time welcome modal
(function () {
  const STORAGE_KEY = "tof_welcome_shown";

  function injectStyles() {
    if (document.getElementById("tof-welcome-styles")) return;
    const style = document.createElement("style");
    style.id = "tof-welcome-styles";
    style.textContent = `
      #tof-welcome-modal {
        position: fixed; inset: 0; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
      }
      .tof-welcome-backdrop {
        position: absolute; inset: 0; background: rgba(0,0,0,0.6);
      }
      .tof-welcome-content {
        position: relative; background: var(--panel, #fff); color: var(--ink, #111);
        border-radius: 12px; padding: 32px 28px 24px; max-width: 480px; width: 92%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3); text-align: center;
      }
      .tof-welcome-close {
        position: absolute; top: 12px; right: 12px; background: none; border: none;
        font-size: 20px; cursor: pointer; color: var(--muted, #666); line-height: 1; padding: 4px;
      }
      .tof-welcome-close:hover { color: var(--ink, #111); }
      .tof-welcome-content h2 {
        margin: 0 0 8px; font-size: 22px; font-weight: 700;
      }
      .tof-welcome-content .tof-welcome-desc {
        font-size: 15px; color: var(--muted, #555); margin: 0 0 24px; line-height: 1.5;
      }
      .tof-welcome-cards {
        display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;
      }
      @media (max-width: 420px) {
        .tof-welcome-cards { grid-template-columns: 1fr; }
      }
      .tof-welcome-card {
        display: block; background: var(--panel, #fff); border: 2px solid var(--border, #eee);
        border-radius: 10px; padding: 20px 16px; text-decoration: none; color: var(--ink, #111);
        transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
      }
      .tof-welcome-card:hover {
        transform: translateY(-2px); border-color: var(--accent, #8b6b3b);
        box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      }
      .tof-welcome-card .tof-welcome-icon {
        font-size: 28px; display: block; margin-bottom: 6px;
      }
      .tof-welcome-card strong {
        display: block; font-size: 16px; margin-bottom: 4px;
      }
      .tof-welcome-card span {
        font-size: 13px; color: var(--muted, #555);
      }
      .tof-welcome-secondary {
        font-size: 13px; color: var(--muted, #555); margin: 0 0 20px;
      }
      .tof-welcome-secondary a {
        color: var(--link, #1a56db); text-decoration: none; font-weight: 600;
      }
      .tof-welcome-secondary a:hover { text-decoration: underline; }
      .tof-welcome-btn {
        display: inline-block; padding: 10px 28px; font-size: 14px; font-weight: 600;
        background: var(--accent, #8b6b3b); color: #fff; border: none; border-radius: 8px;
        cursor: pointer; transition: opacity 0.15s;
      }
      .tof-welcome-btn:hover { opacity: 0.85; }
    `;
    document.head.appendChild(style);
  }

  function dismiss() {
    const m = document.getElementById("tof-welcome-modal");
    if (m) m.remove();
    try { localStorage.setItem(STORAGE_KEY, "true"); } catch (e) {}
  }

  function show() {
    // Remove any existing instance
    const existing = document.getElementById("tof-welcome-modal");
    if (existing) existing.remove();

    injectStyles();

    const modal = document.createElement("div");
    modal.id = "tof-welcome-modal";
    modal.innerHTML = `
      <div class="tof-welcome-backdrop"></div>
      <div class="tof-welcome-content">
        <button class="tof-welcome-close" title="Close">&times;</button>
        <h2>Welcome to Type of Faith!</h2>
        <p class="tof-welcome-desc">Learn to type while discovering Bible verses.</p>
        <div class="tof-welcome-cards">
          <a href="lessons.html" class="tof-welcome-card" data-tof-welcome-nav>
            <span class="tof-welcome-icon">&#127891;</span>
            <strong>Lessons</strong>
            <span>New to typing? Start here</span>
          </a>
          <a href="practice.html" class="tof-welcome-card" data-tof-welcome-nav>
            <span class="tof-welcome-icon">&#9997;</span>
            <strong>Practice</strong>
            <span>Jump in and start typing verses</span>
          </a>
        </div>
        <p class="tof-welcome-secondary">Also try: <a href="quiz.html" data-tof-welcome-nav>Quiz</a> &middot; <a href="race.html" data-tof-welcome-nav>Race</a></p>
        <button class="tof-welcome-btn">Got it</button>
      </div>
    `;

    // Set flag before navigation on any link
    modal.querySelectorAll("[data-tof-welcome-nav]").forEach(function (el) {
      el.addEventListener("click", function () {
        try { localStorage.setItem(STORAGE_KEY, "true"); } catch (e) {}
      });
    });

    modal.querySelector(".tof-welcome-backdrop").addEventListener("click", dismiss);
    modal.querySelector(".tof-welcome-close").addEventListener("click", dismiss);
    modal.querySelector(".tof-welcome-btn").addEventListener("click", dismiss);

    var escHandler = function (e) {
      if (e.key === "Escape") { dismiss(); document.removeEventListener("keydown", escHandler); }
    };
    document.addEventListener("keydown", escHandler);

    document.body.appendChild(modal);
  }

  // Auto-show for first-time visitors
  try {
    if (!localStorage.getItem(STORAGE_KEY)) {
      show();
    }
  } catch (e) { /* localStorage unavailable */ }

  window.TofWelcome = { show: show };
})();
