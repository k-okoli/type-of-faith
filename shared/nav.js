// shared/nav.js — Injects a consistent navigation bar at the top of <body>
(function injectNav() {
  const pages = [
    { label: "Practice", href: "index.html" },
    { label: "Lessons",  href: "lessons.html" },
    { label: "Quiz",     href: "quiz.html" }
  ];

  const currentPage = location.pathname.split("/").pop() || "index.html";

  const nav = document.createElement("nav");
  nav.className = "tof-nav";

  // Brand
  const brand = document.createElement("span");
  brand.className = "tof-brand";
  brand.textContent = "Type of Faith";
  nav.appendChild(brand);

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

  // Theme select
  const themeLabel = document.createElement("label");
  themeLabel.style.cssText = "display:flex;align-items:center;gap:4px;font-size:14px;color:var(--muted);";
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
