// shared/audio.js — Simple audio cues using Web Audio API
(function() {
  let audioCtx = null;
  let muted = localStorage.getItem('tof_audio_muted') === 'true';

  // Lazy init audio context (must be after user interaction)
  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Play a tone with given frequency, duration, and type
  function playTone(freq, duration, type = 'sine', volume = 0.3) {
    if (muted) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = volume;

      // Fade out to avoid click
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio not supported or blocked
    }
  }

  // Play a sequence of tones
  function playSequence(notes, interval = 0.1) {
    if (muted) return;
    notes.forEach((note, i) => {
      setTimeout(() => {
        playTone(note.freq, note.dur || 0.1, note.type || 'sine', note.vol || 0.3);
      }, i * interval * 1000);
    });
  }

  // --- Sound Effects ---

  // Correct keystroke - short high blip
  function playCorrect() {
    playTone(880, 0.05, 'sine', 0.15);
  }

  // Error keystroke - short low buzz
  function playError() {
    playTone(200, 0.1, 'square', 0.2);
  }

  // Drill/verse complete - ascending success sound
  function playComplete() {
    playSequence([
      { freq: 523, dur: 0.1 },  // C5
      { freq: 659, dur: 0.1 },  // E5
      { freq: 784, dur: 0.15 }, // G5
      { freq: 1047, dur: 0.2 }  // C6
    ], 0.1);
  }

  // Race finish - celebratory fanfare
  function playRaceFinish() {
    playSequence([
      { freq: 523, dur: 0.1 },
      { freq: 659, dur: 0.1 },
      { freq: 784, dur: 0.1 },
      { freq: 1047, dur: 0.3 }
    ], 0.08);
  }

  // Countdown beep
  function playCountdown() {
    playTone(440, 0.15, 'sine', 0.25);
  }

  // Countdown GO! - higher pitch
  function playGo() {
    playTone(880, 0.25, 'sine', 0.3);
  }

  // Retry/fail sound - descending
  function playRetry() {
    playSequence([
      { freq: 400, dur: 0.15 },
      { freq: 300, dur: 0.2 }
    ], 0.15);
  }

  // --- Mute Control ---
  function setMuted(val) {
    muted = val;
    localStorage.setItem('tof_audio_muted', val ? 'true' : 'false');
    updateMuteButton();
  }

  function isMuted() {
    return muted;
  }

  function toggleMute() {
    setMuted(!muted);
    // Play a test sound when unmuting
    if (!muted) {
      playTone(660, 0.1, 'sine', 0.2);
    }
    return muted;
  }

  // Update mute button appearance if it exists
  function updateMuteButton() {
    const btn = document.getElementById('muteBtn');
    if (btn) {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.title = muted ? 'Unmute sounds' : 'Mute sounds';
    }
  }

  // Initialize mute button on page load
  function initMuteButton() {
    updateMuteButton();
    const btn = document.getElementById('muteBtn');
    if (btn) {
      btn.addEventListener('click', toggleMute);
    }
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMuteButton);
  } else {
    initMuteButton();
  }

  // Expose API globally
  window.TofAudio = {
    playCorrect,
    playError,
    playComplete,
    playRaceFinish,
    playCountdown,
    playGo,
    playRetry,
    setMuted,
    isMuted,
    toggleMute
  };
})();
