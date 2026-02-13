/**
 * Type of Faith - Achievements & Avatar Unlocking System
 *
 * Tracks player progress and unlocks avatars based on achievements.
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'tof_achievements';

  // ============================================
  // Avatar Definitions with Unlock Conditions
  // ============================================

  const AVATAR_UNLOCK_CONDITIONS = {
    'moses': {
      name: 'Moses',
      src: 'assets/avatars/moses-2d.png',
      unlocked: true, // Default avatar
      requirement: null,
      description: 'Default character'
    },
    'david': {
      name: 'David & Goliath',
      src: 'assets/avatars/david-and-goliath-2d.png',
      unlocked: false,
      requirement: { type: 'races_won', value: 5 },
      description: 'Win 5 races'
    },
    'elijah': {
      name: 'Elijah',
      src: 'assets/avatars/elijah-2d.png',
      unlocked: false,
      requirement: { type: 'max_wpm', value: 60 },
      description: 'Reach 60 WPM'
    },
    'jonah': {
      name: 'Jonah',
      src: 'assets/avatars/jonah-2d.png',
      unlocked: false,
      requirement: { type: 'daily_challenges', value: 10 },
      description: 'Complete 10 daily challenges'
    },
    'noahs-ark': {
      name: "Noah's Ark",
      src: 'assets/avatars/noahs-ark-2d.png',
      unlocked: false,
      requirement: { type: 'lessons_completed', value: 10 },
      description: 'Complete all 10 lessons'
    },
    'burning-bush': {
      name: 'Burning Bush',
      src: 'assets/avatars/burning-bush-2d.png',
      unlocked: false,
      requirement: { type: 'perfect_accuracy', value: 1 },
      description: 'Achieve 100% accuracy'
    },
    'ten-commandments': {
      name: 'Commandments',
      src: 'assets/avatars/ten-commandments-2d.png',
      unlocked: false,
      requirement: { type: 'practice_sessions', value: 50 },
      description: 'Complete 50 practice sessions'
    }
  };

  // ============================================
  // Default Achievement State
  // ============================================

  const DEFAULT_ACHIEVEMENTS = {
    races_won: 0,
    max_wpm: 0,
    daily_challenges: 0,
    lessons_completed: 0,
    perfect_accuracy: 0,
    practice_sessions: 0,
    quizzes_completed: 0,
    unlocked_avatars: ['moses'] // Moses is always unlocked
  };

  // ============================================
  // Storage Functions
  // ============================================

  function getAchievements() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new fields
        return { ...DEFAULT_ACHIEVEMENTS, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load achievements:', e);
    }
    return { ...DEFAULT_ACHIEVEMENTS };
  }

  function saveAchievements(achievements) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(achievements));
    } catch (e) {
      console.warn('Failed to save achievements:', e);
    }
  }

  // ============================================
  // Achievement Tracking
  // ============================================

  function incrementStat(statName, amount = 1) {
    const achievements = getAchievements();
    achievements[statName] = (achievements[statName] || 0) + amount;
    saveAchievements(achievements);
    checkUnlocks(achievements);
    return achievements;
  }

  function setStatIfHigher(statName, value) {
    const achievements = getAchievements();
    if (value > (achievements[statName] || 0)) {
      achievements[statName] = value;
      saveAchievements(achievements);
      checkUnlocks(achievements);
    }
    return achievements;
  }

  function recordPracticeSession(wpm, accuracy) {
    const achievements = getAchievements();

    achievements.practice_sessions = (achievements.practice_sessions || 0) + 1;

    if (wpm > (achievements.max_wpm || 0)) {
      achievements.max_wpm = wpm;
    }

    if (accuracy === 100) {
      achievements.perfect_accuracy = (achievements.perfect_accuracy || 0) + 1;
    }

    saveAchievements(achievements);
    return checkUnlocks(achievements);
  }

  function recordRaceWin() {
    const achievements = getAchievements();
    achievements.races_won = (achievements.races_won || 0) + 1;
    saveAchievements(achievements);
    return checkUnlocks(achievements);
  }

  function recordDailyChallenge() {
    const achievements = getAchievements();
    achievements.daily_challenges = (achievements.daily_challenges || 0) + 1;
    saveAchievements(achievements);
    return checkUnlocks(achievements);
  }

  function recordLessonComplete(lessonNumber) {
    const achievements = getAchievements();
    // Track highest lesson completed
    if (lessonNumber > (achievements.lessons_completed || 0)) {
      achievements.lessons_completed = lessonNumber;
    }
    saveAchievements(achievements);
    return checkUnlocks(achievements);
  }

  function recordQuizComplete() {
    const achievements = getAchievements();
    achievements.quizzes_completed = (achievements.quizzes_completed || 0) + 1;
    saveAchievements(achievements);
    return checkUnlocks(achievements);
  }

  // ============================================
  // Unlock Checking
  // ============================================

  function checkUnlocks(achievements) {
    const newUnlocks = [];

    for (const [avatarId, config] of Object.entries(AVATAR_UNLOCK_CONDITIONS)) {
      // Skip if already unlocked or no requirement
      if (achievements.unlocked_avatars.includes(avatarId)) continue;
      if (!config.requirement) continue;

      const { type, value } = config.requirement;
      const currentValue = achievements[type] || 0;

      if (currentValue >= value) {
        achievements.unlocked_avatars.push(avatarId);
        newUnlocks.push({
          id: avatarId,
          name: config.name,
          src: config.src
        });
      }
    }

    if (newUnlocks.length > 0) {
      saveAchievements(achievements);
    }

    return newUnlocks;
  }

  function isAvatarUnlocked(avatarId) {
    const achievements = getAchievements();
    return achievements.unlocked_avatars.includes(avatarId);
  }

  function getUnlockProgress(avatarId) {
    const config = AVATAR_UNLOCK_CONDITIONS[avatarId];
    if (!config || !config.requirement) {
      return { unlocked: true, current: 0, required: 0, percent: 100 };
    }

    const achievements = getAchievements();
    const { type, value } = config.requirement;
    const current = achievements[type] || 0;
    const unlocked = achievements.unlocked_avatars.includes(avatarId);

    return {
      unlocked,
      current: Math.min(current, value),
      required: value,
      percent: Math.min(100, Math.round((current / value) * 100)),
      description: config.description
    };
  }

  function getAllAvatarsWithStatus() {
    const achievements = getAchievements();
    return Object.entries(AVATAR_UNLOCK_CONDITIONS).map(([id, config]) => {
      const progress = getUnlockProgress(id);
      return {
        id,
        name: config.name,
        src: config.src,
        unlocked: progress.unlocked,
        progress,
        description: config.description
      };
    });
  }

  // ============================================
  // UI Notification Helper
  // ============================================

  function showUnlockNotification(avatar) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'unlock-notification';
    notification.innerHTML = `
      <div class="unlock-content">
        <div class="unlock-icon">🎉</div>
        <div class="unlock-text">
          <div class="unlock-title">Avatar Unlocked!</div>
          <div class="unlock-name">${avatar.name}</div>
        </div>
        <img class="unlock-avatar" src="${avatar.src}" alt="${avatar.name}" />
      </div>
    `;

    // Add styles if not already present
    if (!document.getElementById('unlock-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'unlock-notification-styles';
      styles.textContent = `
        .unlock-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
          color: #1a1a1a;
          padding: 16px 20px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(255, 215, 0, 0.4);
          z-index: 10000;
          animation: slideIn 0.5s ease-out, fadeOut 0.5s ease-in 3.5s forwards;
        }
        .unlock-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .unlock-icon {
          font-size: 28px;
        }
        .unlock-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.8;
        }
        .unlock-name {
          font-size: 18px;
          font-weight: 700;
        }
        .unlock-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 3px solid rgba(255,255,255,0.5);
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    // Remove after animation
    setTimeout(() => {
      notification.remove();
    }, 4000);
  }

  // ============================================
  // Stats Display Helper
  // ============================================

  function getStatsHTML() {
    const a = getAchievements();
    return `
      <div class="achievement-stats">
        <div class="stat-item"><span class="stat-value">${a.practice_sessions}</span> Sessions</div>
        <div class="stat-item"><span class="stat-value">${a.races_won}</span> Races Won</div>
        <div class="stat-item"><span class="stat-value">${a.max_wpm}</span> Best WPM</div>
        <div class="stat-item"><span class="stat-value">${a.daily_challenges}</span> Daily Challenges</div>
        <div class="stat-item"><span class="stat-value">${a.lessons_completed}/10</span> Lessons</div>
        <div class="stat-item"><span class="stat-value">${a.perfect_accuracy}</span> Perfect Runs</div>
      </div>
    `;
  }

  // ============================================
  // Export to Global
  // ============================================

  window.TofAchievements = {
    // Data access
    getAchievements,
    getAllAvatarsWithStatus,
    isAvatarUnlocked,
    getUnlockProgress,

    // Recording events
    recordPracticeSession,
    recordRaceWin,
    recordDailyChallenge,
    recordLessonComplete,
    recordQuizComplete,
    incrementStat,
    setStatIfHigher,

    // UI helpers
    showUnlockNotification,
    getStatsHTML,

    // Constants
    AVATAR_UNLOCK_CONDITIONS
  };

})();
