/**
 * Type of Faith - Leaderboard & Auth Client
 *
 * Handles user authentication and leaderboard API calls.
 * Uses "username only" auth - the token IS your password.
 */

(function() {
  'use strict';

  const API_BASE = TofConfig.API_BASE;
  const TOKEN_KEY = 'tof_auth_token';
  const USER_KEY = 'tof_user';

  // ============================================
  // Storage Helpers
  // ============================================

  function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function storeAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // ============================================
  // API Helpers
  // ============================================

  async function apiCall(endpoint, options = {}) {
    const token = getStoredToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw { status: response.status, detail: data.detail || 'Request failed' };
      }

      return data;
    } catch (error) {
      if (error.status) throw error;
      throw { status: 0, detail: 'Network error - is the server running?' };
    }
  }

  // ============================================
  // Auth Functions
  // ============================================

  /**
   * Check if user is logged in (has valid token).
   * Makes a quick API call to verify token is still valid.
   */
  async function checkAuth() {
    const token = getStoredToken();
    if (!token) return null;

    try {
      const user = await apiCall('/auth/me');
      storeAuth(token, user);
      return user;
    } catch (error) {
      if (error.status === 401) {
        clearAuth();
      }
      return null;
    }
  }

  /**
   * Register a new user with just a username.
   * Returns the user object and stores the token.
   */
  async function register(username) {
    const data = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username }),
      skipAuth: true
    });

    // Store the token - this is their "password"!
    storeAuth(data.token, {
      user_id: data.user_id,
      username: data.username
    });

    return data;
  }

  /**
   * Log out (clear local token and invalidate on server).
   */
  async function logout() {
    try {
      await apiCall('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors - clear local storage anyway
    }
    clearAuth();
  }

  /**
   * Get current user (from local storage, no API call).
   */
  function getCurrentUser() {
    return getStoredUser();
  }

  /**
   * Check if user is authenticated (has token).
   */
  function isAuthenticated() {
    return !!getStoredToken();
  }

  // ============================================
  // Leaderboard Functions
  // ============================================

  /**
   * Get daily challenge leaderboard.
   * @param {string} date - Optional date (YYYY-MM-DD), defaults to today
   */
  async function getDailyLeaderboard(date = null) {
    const params = date ? `?challenge_date=${date}` : '';
    return apiCall(`/leaderboard/daily${params}`, { skipAuth: true });
  }

  /**
   * Submit a daily challenge score.
   * Requires authentication.
   */
  async function submitDailyScore(wpm, accuracy, timeSeconds, verseRef = null) {
    if (!isAuthenticated()) {
      throw { status: 401, detail: 'Please log in to submit scores' };
    }

    return apiCall('/leaderboard/daily/submit', {
      method: 'POST',
      body: JSON.stringify({
        wpm,
        accuracy,
        time_seconds: timeSeconds,
        verse_ref: verseRef
      })
    });
  }

  /**
   * Get all-time leaderboard.
   */
  async function getAllTimeLeaderboard(limit = 50) {
    return apiCall(`/leaderboard/alltime?limit=${limit}`, { skipAuth: true });
  }

  // ============================================
  // UI Components
  // ============================================

  /**
   * Show login/register modal.
   * Returns a promise that resolves when user logs in.
   */
  function showAuthModal() {
    return new Promise((resolve, reject) => {
      // Remove existing modal if any
      const existing = document.getElementById('tof-auth-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'tof-auth-modal';
      modal.innerHTML = `
        <div class="tof-modal-backdrop"></div>
        <div class="tof-modal-content">
          <h3>Join the Leaderboard</h3>
          <p>Pick a username to track your scores and compete with others.</p>
          <input type="text" id="tof-username-input" placeholder="Enter username" maxlength="20" />
          <div class="tof-modal-error" id="tof-auth-error"></div>
          <div class="tof-modal-buttons">
            <button id="tof-auth-cancel">Cancel</button>
            <button id="tof-auth-submit">Join</button>
          </div>
          <p class="tof-modal-hint">
            2-20 characters, letters/numbers/underscores only.<br>
            No password needed — your browser remembers you.
          </p>
        </div>
      `;

      // Add styles
      if (!document.getElementById('tof-auth-styles')) {
        const styles = document.createElement('style');
        styles.id = 'tof-auth-styles';
        styles.textContent = `
          #tof-auth-modal {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .tof-modal-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.6);
          }
          .tof-modal-content {
            position: relative;
            background: var(--panel, #fff);
            color: var(--ink, #111);
            border-radius: 12px;
            padding: 24px;
            max-width: 360px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          }
          .tof-modal-content h3 {
            margin: 0 0 8px;
            font-size: 20px;
          }
          .tof-modal-content p {
            margin: 0 0 16px;
            font-size: 14px;
            color: var(--muted, #666);
          }
          .tof-modal-content input {
            width: 100%;
            padding: 12px;
            font-size: 16px;
            border: 1px solid var(--border, #ddd);
            border-radius: 8px;
            background: var(--bg, #fff);
            color: var(--ink, #111);
          }
          .tof-modal-error {
            color: var(--err, #c00);
            font-size: 13px;
            min-height: 20px;
            margin: 8px 0;
          }
          .tof-modal-buttons {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          }
          .tof-modal-buttons button {
            padding: 10px 20px;
            font-size: 14px;
            border-radius: 6px;
            cursor: pointer;
          }
          #tof-auth-cancel {
            background: transparent;
            border: 1px solid var(--border, #ddd);
            color: var(--muted, #666);
          }
          #tof-auth-submit {
            background: var(--accent, #8b6b3b);
            border: none;
            color: #fff;
          }
          .tof-modal-hint {
            font-size: 11px !important;
            margin-top: 16px !important;
            text-align: center;
          }
        `;
        document.head.appendChild(styles);
      }

      document.body.appendChild(modal);

      const input = document.getElementById('tof-username-input');
      const errorEl = document.getElementById('tof-auth-error');
      const cancelBtn = document.getElementById('tof-auth-cancel');
      const submitBtn = document.getElementById('tof-auth-submit');

      input.focus();

      async function handleSubmit() {
        const username = input.value.trim();
        if (!username) {
          errorEl.textContent = 'Please enter a username';
          return;
        }

        if (!/^[a-zA-Z0-9_]{2,20}$/.test(username)) {
          errorEl.textContent = 'Invalid username format';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Joining...';
        errorEl.textContent = '';

        try {
          const user = await register(username);
          modal.remove();
          resolve(user);
        } catch (error) {
          errorEl.textContent = error.detail || 'Registration failed';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Join';
        }
      }

      submitBtn.addEventListener('click', handleSubmit);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSubmit();
      });

      cancelBtn.addEventListener('click', () => {
        modal.remove();
        reject({ cancelled: true });
      });

      modal.querySelector('.tof-modal-backdrop').addEventListener('click', () => {
        modal.remove();
        reject({ cancelled: true });
      });
    });
  }

  /**
   * Render leaderboard HTML.
   */
  function renderLeaderboard(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data.scores || data.scores.length === 0) {
      container.innerHTML = '<p class="tof-lb-empty">No scores yet. Be the first!</p>';
      return;
    }

    const currentUser = getCurrentUser();

    container.innerHTML = `
      <table class="tof-leaderboard">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>WPM</th>
            <th>Acc</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${data.scores.map(s => `
            <tr class="${currentUser && s.username === currentUser.username ? 'tof-lb-you' : ''}">
              <td class="tof-lb-rank ${s.rank <= 3 ? 'tof-lb-top' + s.rank : ''}">${s.rank}</td>
              <td class="tof-lb-player">
                <img src="assets/avatars/${s.avatar_id}-2d.png" alt="" />
                ${s.username}
              </td>
              <td>${s.wpm}</td>
              <td>${s.accuracy}%</td>
              <td>${s.time_seconds.toFixed(1)}s</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Add leaderboard styles
  if (!document.getElementById('tof-lb-styles')) {
    const styles = document.createElement('style');
    styles.id = 'tof-lb-styles';
    styles.textContent = `
      .tof-leaderboard {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      .tof-leaderboard th, .tof-leaderboard td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid var(--border, #eee);
      }
      .tof-leaderboard th {
        font-weight: 600;
        color: var(--muted, #666);
        font-size: 12px;
      }
      .tof-lb-player {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tof-lb-player img {
        width: 24px;
        height: 24px;
        border-radius: 50%;
      }
      .tof-lb-rank { font-weight: 700; }
      .tof-lb-top1 { color: #ffd700; }
      .tof-lb-top2 { color: #c0c0c0; }
      .tof-lb-top3 { color: #cd7f32; }
      .tof-lb-you { background: color-mix(in srgb, var(--accent, #8b6b3b) 15%, transparent); }
      .tof-lb-empty { text-align: center; color: var(--muted, #666); padding: 20px; }
    `;
    document.head.appendChild(styles);
  }

  // ============================================
  // Export to Global
  // ============================================

  window.TofLeaderboard = {
    // Auth
    checkAuth,
    register,
    logout,
    getCurrentUser,
    isAuthenticated,
    showAuthModal,

    // Leaderboard
    getDailyLeaderboard,
    submitDailyScore,
    getAllTimeLeaderboard,
    renderLeaderboard
  };

})();
