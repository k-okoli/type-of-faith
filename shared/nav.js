// shared/nav.js — Injects a consistent navigation bar at the top of <body>
(function injectNav() {
  const pages = [
    { label: "Practice", href: "practice.html" },
    { label: "Lessons",  href: "lessons.html" },
    { label: "Quiz",     href: "quiz.html" },
    { label: "Race",     href: "race.html" },
    { label: "Multiplayer", href: "lobby.html" },
    { label: "Profile",  href: "profile.html" }
  ];

  const currentPage = location.pathname.split("/").pop() || "index.html";

  const nav = document.createElement("nav");
  nav.className = "tof-nav";

  // Brand
  const brand = document.createElement("span");
  brand.className = "tof-brand";
  brand.textContent = "Type of Faith";
  nav.appendChild(brand);

  // Streak badge (hidden by default, shown by streak.js)
  const streakBadge = document.createElement("span");
  streakBadge.id = "tof-streak-badge";
  streakBadge.className = "tof-streak-badge";
  streakBadge.style.display = "none";
  nav.appendChild(streakBadge);

  // Links
  const links = document.createElement("div");
  links.className = "tof-links";
  for (const p of pages) {
    const a = document.createElement("a");
    a.href = p.href;
    a.textContent = p.label;
    if (currentPage === p.href) a.classList.add("active");
    links.appendChild(a);
  }
  nav.appendChild(links);

  // Spacer
  const spacer = document.createElement("div");
  spacer.className = "tof-spacer";
  nav.appendChild(spacer);

  // Mute button
  const muteBtn = document.createElement("button");
  muteBtn.id = "muteBtn";
  muteBtn.className = "tof-mute-btn";
  muteBtn.textContent = localStorage.getItem('tof_audio_muted') === 'true' ? '🔇' : '🔊';
  muteBtn.title = localStorage.getItem('tof_audio_muted') === 'true' ? 'Unmute sounds' : 'Mute sounds';
  nav.appendChild(muteBtn);

  // Settings gear button
  const settingsBtn = document.createElement("button");
  settingsBtn.className = "tof-settings-btn";
  settingsBtn.textContent = "\u2699\uFE0F";
  settingsBtn.title = "Settings";
  settingsBtn.addEventListener("click", () => {
    if (typeof TofSettings !== "undefined") TofSettings.show();
  });
  nav.appendChild(settingsBtn);

  // Theme select
  const themeLabel = document.createElement("label");
  themeLabel.className = "tof-theme-label";
  themeLabel.textContent = "Theme: ";
  const sel = document.createElement("select");
  sel.id = "themeMode";
  sel.className = "tof-theme-select";
  for (const v of ["auto", "light", "dark"]) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
    sel.appendChild(opt);
  }
  themeLabel.appendChild(sel);
  nav.appendChild(themeLabel);

  document.body.prepend(nav);
})();
