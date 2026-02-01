// shared/data.js — Verse categories & helpers shared by index.html and quiz.html
const VERSE_CATEGORIES = {
  anger: ["Ephesians 4:26","Proverbs 15:1","James 1:19-20","Colossians 3:8"],
  anxiety: ["Philippians 4:6-7","1 Peter 5:7","Matthew 6:34","Psalm 94:19"],
  courage: ["Joshua 1:9","Psalm 27:1","2 Timothy 1:7","Deuteronomy 31:6"],
  depression: ["Psalm 34:17-18","Psalm 42:11","Isaiah 41:10","Matthew 11:28"],
  doubt: ["James 1:6","Mark 9:24","Matthew 21:21","John 20:27"],
  faith: ["Hebrews 11:1","Proverbs 3:5-6","Mark 11:24","2 Corinthians 5:7"],
  fear: ["Isaiah 41:10","2 Timothy 1:7","Psalm 56:3","Deuteronomy 31:6"],
  forgiveness: ["Ephesians 4:32","Colossians 3:13","Matthew 6:14","Psalm 103:12"],
  healing: ["Jeremiah 30:17","Isaiah 53:5","James 5:14-15","Psalm 147:3"],
  hope: ["Jeremiah 29:11","Romans 15:13","Psalm 42:5","Isaiah 40:31"],
  jealousy: ["Proverbs 14:30","James 3:16","Galatians 5:26","1 Corinthians 3:3"],
  joy: ["Nehemiah 8:10","Psalm 16:11","Philippians 4:4","John 15:11"],
  loss: ["Psalm 34:18","Matthew 5:4","Revelation 21:4","1 Thessalonians 4:13-14"],
  love: ["1 Corinthians 13:4-7","John 13:34","1 John 4:7","Romans 12:10","John 3:16"],
  patience: ["Galatians 6:9","Romans 12:12","James 5:8","Ecclesiastes 7:8"],
  peace: ["John 14:27","Philippians 4:7","Isaiah 26:3","Colossians 3:15"],
  pride: ["Proverbs 16:18","James 4:6","1 Peter 5:5","Proverbs 11:2"],
  stress: ["Matthew 11:28-30","John 16:33","Psalm 55:22","Proverbs 12:25"],
  temptation: ["1 Corinthians 10:13","Matthew 26:41","James 1:12-14","Hebrews 2:18"],
  wisdom: ["James 1:5","Proverbs 1:7","Proverbs 3:13","Proverbs 4:7"]
};

const ALL_REFERENCES = Object.values(VERSE_CATEGORIES).flat();

const REF_TO_CATEGORY = (() => {
  const map = {};
  const cats = Object.keys(VERSE_CATEGORIES).sort((a, b) => a.localeCompare(b));
  for (const c of cats) for (const r of VERSE_CATEGORIES[c]) if (!map[r]) map[r] = c;
  return map;
})();

function titleCase(s) {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function showBanner(type, message) {
  const el = document.getElementById("banner");
  if (!el) return;
  el.textContent = message || "";
  el.style.display = message ? "block" : "none";
  el.style.color = (type === "error") ? "var(--err)"
                 : (type === "warn")  ? "var(--accent)"
                 : (type === "success") ? "var(--ok)"
                 : "var(--muted)";
  // Reset class-based styling (used by quiz.html)
  el.className = "";
}
