// shared/streak.js — Streak counter for consecutive practice days
(function () {
  const STORAGE_KEY = "tof_streak";

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Failed to load streak:", e);
    }
    return { current: 0, longest: 0, lastActiveDate: null };
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Record that the user was active today.
   * Call on verse/drill/quiz completion.
   */
  function recordActivity() {
    const data = load();
    const today = todayStr();

    if (data.lastActiveDate === today) return; // already recorded today

    if (data.lastActiveDate === yesterdayStr()) {
      data.current += 1;
    } else {
      data.current = 1; // new streak
    }

    if (data.current > data.longest) {
      data.longest = data.current;
    }

    data.lastActiveDate = today;
    save(data);

    // Update nav badge if present
    updateBadge(data.current);
  }

  /**
   * Get current streak info. Returns lazy-checked values
   * (if streak is broken, current resets to 0).
   */
  function getStreak() {
    const data = load();
    const today = todayStr();

    // If last active was today or yesterday, streak is alive
    if (data.lastActiveDate === today || data.lastActiveDate === yesterdayStr()) {
      return { current: data.current, longest: data.longest, lastActiveDate: data.lastActiveDate };
    }

    // Streak is broken
    return { current: 0, longest: data.longest, lastActiveDate: data.lastActiveDate };
  }

  /** Update the nav streak badge */
  function updateBadge(count) {
    const badge = document.getElementById("tof-streak-badge");
    if (!badge) return;
    if (count > 0) {
      badge.textContent = "\uD83D\uDD25 " + count;
      badge.style.display = "";
    } else {
      badge.style.display = "none";
    }
  }

  /** Initialize badge from stored data */
  function initBadge() {
    const s = getStreak();
    updateBadge(s.current);
  }

  window.TofStreak = {
    recordActivity,
    getStreak,
    initBadge
  };
})();
