// shared/seasons.js — Seasonal events for Christian calendar
(function() {
  'use strict';

  // ========================================
  // Seasonal Verse Collections
  // ========================================
  const CHRISTMAS_VERSES = [
    // Prophecies
    "Isaiah 7:14",
    "Isaiah 9:6",
    "Micah 5:2",
    // Nativity
    "Luke 1:30-31",
    "Luke 1:46-47",
    "Luke 2:7",
    "Luke 2:10-11",
    "Luke 2:14",
    "Luke 2:20",
    "Matthew 1:21",
    "Matthew 1:23",
    "Matthew 2:1-2",
    "Matthew 2:10-11",
    // John's Prologue
    "John 1:1",
    "John 1:14",
    "John 3:16",
    // Gifts & Light
    "2 Corinthians 9:15",
    "James 1:17",
    "John 8:12"
  ];

  const EASTER_VERSES = [
    // Palm Sunday
    "Matthew 21:9",
    "John 12:13",
    // Last Supper
    "John 13:34",
    "Luke 22:19",
    // Crucifixion
    "John 19:30",
    "Luke 23:34",
    "Luke 23:43",
    "Isaiah 53:5",
    "Romans 5:8",
    "1 Peter 2:24",
    // Resurrection
    "Matthew 28:5-6",
    "Luke 24:6",
    "John 11:25-26",
    "Romans 6:9",
    "1 Corinthians 15:3-4",
    "1 Corinthians 15:55-57",
    // Victory & Hope
    "Romans 8:11",
    "Philippians 3:10",
    "1 Peter 1:3",
    "Revelation 1:18"
  ];

  // ========================================
  // Date Calculations
  // ========================================

  /**
   * Calculate Easter Sunday for a given year (Anonymous Gregorian algorithm)
   */
  function calculateEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  /**
   * Get Palm Sunday (7 days before Easter)
   */
  function getPalmSunday(year) {
    const easter = calculateEaster(year);
    const palm = new Date(easter);
    palm.setDate(palm.getDate() - 7);
    return palm;
  }

  // ========================================
  // Season Detection
  // ========================================

  /**
   * Detect the current active season (if any)
   * Returns: { id, name, icon, verses, theme } or null
   */
  function getCurrentSeason(date = new Date()) {
    const month = date.getMonth(); // 0-11
    const day = date.getDate();
    const year = date.getFullYear();

    // Christmas Season: December 1-25
    if (month === 11 && day >= 1 && day <= 25) {
      return {
        id: 'christmas',
        name: 'Christmas',
        subtitle: 'Celebrating the Birth of Christ',
        icon: '🎄',
        verses: CHRISTMAS_VERSES,
        theme: {
          accent: '#c41e3a',      // Christmas red
          accentAlt: '#165b33',   // Christmas green
          glow: 'rgba(196, 30, 58, 0.3)',
          banner: 'linear-gradient(135deg, #165b33 0%, #c41e3a 100%)'
        }
      };
    }

    // Easter Season: Palm Sunday through Easter Sunday
    const palmSunday = getPalmSunday(year);
    const easterSunday = calculateEaster(year);

    // Extend Easter to include the week after (Easter Week)
    const easterEnd = new Date(easterSunday);
    easterEnd.setDate(easterEnd.getDate() + 7);

    if (date >= palmSunday && date <= easterEnd) {
      // Determine if we're before or after Easter
      const isResurrection = date >= easterSunday;
      return {
        id: 'easter',
        name: isResurrection ? 'Easter' : 'Holy Week',
        subtitle: isResurrection ? 'He Is Risen!' : 'The Passion of Christ',
        icon: isResurrection ? '✝️' : '🕊️',
        verses: EASTER_VERSES,
        theme: {
          accent: isResurrection ? '#daa520' : '#6b3fa0',  // Gold or Purple
          accentAlt: isResurrection ? '#ffffff' : '#4a2c7a',
          glow: isResurrection ? 'rgba(218, 165, 32, 0.3)' : 'rgba(107, 63, 160, 0.3)',
          banner: isResurrection
            ? 'linear-gradient(135deg, #daa520 0%, #f5f5dc 100%)'
            : 'linear-gradient(135deg, #4a2c7a 0%, #6b3fa0 100%)'
        }
      };
    }

    return null;
  }

  /**
   * Get a random verse from the current season
   */
  function getSeasonalVerse(season = getCurrentSeason()) {
    if (!season || !season.verses || season.verses.length === 0) {
      return null;
    }
    const idx = Math.floor(Math.random() * season.verses.length);
    return season.verses[idx];
  }

  /**
   * Get the daily seasonal verse (date-seeded)
   */
  function getDailySeasonalVerse(season = getCurrentSeason(), date = new Date()) {
    if (!season || !season.verses || season.verses.length === 0) {
      return null;
    }
    // Seed based on date
    const dateStr = date.toISOString().split('T')[0];
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
      hash = hash & hash;
    }
    const idx = Math.abs(hash) % season.verses.length;
    return season.verses[idx];
  }

  /**
   * Apply seasonal theme to document
   */
  function applySeasonalTheme(season = getCurrentSeason()) {
    const root = document.documentElement;

    if (season && season.theme) {
      root.style.setProperty('--seasonal-accent', season.theme.accent);
      root.style.setProperty('--seasonal-accent-alt', season.theme.accentAlt);
      root.style.setProperty('--seasonal-glow', season.theme.glow);
      root.style.setProperty('--seasonal-banner', season.theme.banner);
      root.setAttribute('data-season', season.id);
    } else {
      root.style.removeProperty('--seasonal-accent');
      root.style.removeProperty('--seasonal-accent-alt');
      root.style.removeProperty('--seasonal-glow');
      root.style.removeProperty('--seasonal-banner');
      root.removeAttribute('data-season');
    }
  }

  /**
   * Create seasonal banner HTML
   */
  function createSeasonalBanner(season = getCurrentSeason()) {
    if (!season) return '';

    return `
      <div class="seasonal-banner" data-season="${season.id}">
        <span class="seasonal-icon">${season.icon}</span>
        <div class="seasonal-text">
          <strong>${season.name}</strong>
          <span>${season.subtitle}</span>
        </div>
      </div>
    `;
  }

  // ========================================
  // Expose API
  // ========================================
  window.TofSeasons = {
    getCurrentSeason,
    getSeasonalVerse,
    getDailySeasonalVerse,
    applySeasonalTheme,
    createSeasonalBanner,
    calculateEaster,
    CHRISTMAS_VERSES,
    EASTER_VERSES
  };

})();
