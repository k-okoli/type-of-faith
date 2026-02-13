/**
 * Frontend Unit Tests for Type of Faith
 *
 * Run with: node tests/test_frontend.js
 *
 * These tests cover pure JavaScript functions that can be tested
 * independently of the DOM.
 */

// ============================================
// Test Framework (minimal, no dependencies)
// ============================================

let passed = 0;
let failed = 0;
const failures = [];

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toContain(expected) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected ${actual} to be falsy`);
      }
    }
  };
}

// ============================================
// Functions Under Test (extracted from practice.html)
// ============================================

/**
 * Normalize smart quotes to standard ASCII quotes.
 */
function normalizeQuotes(text) {
  return (text || "")
    .replace(/['\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/["\u201C\u201D\u201E\u201F]/g, '"');
}

/**
 * Normalize text for fuzzy comparison.
 */
function normalizeForComparison(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate date string in YYYY-MM-DD format.
 */
function getTodayDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

/**
 * Generate a seeded random number from a string.
 */
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Classify verse length based on character count.
 */
function classifyVerseLength(text, thresholds = { shortMax: 110, mediumMax: 230 }) {
  const length = text.trim().length;
  if (length <= thresholds.shortMax) return "short";
  if (length <= thresholds.mediumMax) return "medium";
  return "long";
}

/**
 * Levenshtein distance between two strings.
 */
function levenshteinDistance(stringA, stringB) {
  const lengthA = stringA.length;
  const lengthB = stringB.length;

  const matrix = Array.from({ length: lengthA + 1 }, () => new Array(lengthB + 1));

  for (let i = 0; i <= lengthA; i++) matrix[i][0] = i;
  for (let j = 0; j <= lengthB; j++) matrix[0][j] = j;

  for (let i = 1; i <= lengthA; i++) {
    for (let j = 1; j <= lengthB; j++) {
      const cost = stringA[i - 1] === stringB[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[lengthA][lengthB];
}

/**
 * Compute fairness score for Blind Faith mode.
 */
function computeFairnessScore(groundTruth, attempt) {
  const normalizedTruth = normalizeForComparison(groundTruth);
  const normalizedAttempt = normalizeForComparison(attempt);

  if (!normalizedTruth.length) {
    return { scorePercent: 0, distance: 0, baseLength: 0 };
  }

  const distance = levenshteinDistance(normalizedTruth, normalizedAttempt);
  const score = Math.max(0, 1 - distance / normalizedTruth.length);

  return {
    scorePercent: Math.round(score * 100),
    distance,
    baseLength: normalizedTruth.length
  };
}

/**
 * Title case a string.
 */
function titleCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ============================================
// Tests
// ============================================

describe('normalizeQuotes', () => {
  test('converts smart single quotes to ASCII', () => {
    expect(normalizeQuotes("it's")).toBe("it's");
    expect(normalizeQuotes("'hello'")).toBe("'hello'");
    expect(normalizeQuotes("'test'")).toBe("'test'");
  });

  test('converts smart double quotes to ASCII', () => {
    expect(normalizeQuotes('"hello"')).toBe('"hello"');
    expect(normalizeQuotes('"test"')).toBe('"test"');
  });

  test('handles mixed quotes', () => {
    expect(normalizeQuotes('"It's a test"')).toBe('"It\'s a test"');
  });

  test('handles empty and null input', () => {
    expect(normalizeQuotes("")).toBe("");
    expect(normalizeQuotes(null)).toBe("");
    expect(normalizeQuotes(undefined)).toBe("");
  });

  test('preserves plain text', () => {
    expect(normalizeQuotes("Hello world")).toBe("Hello world");
  });
});

describe('normalizeForComparison', () => {
  test('converts to lowercase', () => {
    expect(normalizeForComparison("HELLO")).toBe("hello");
  });

  test('removes punctuation', () => {
    expect(normalizeForComparison("Hello, world!")).toBe("hello world");
  });

  test('collapses whitespace', () => {
    expect(normalizeForComparison("hello   world")).toBe("hello world");
  });

  test('trims whitespace', () => {
    expect(normalizeForComparison("  hello  ")).toBe("hello");
  });

  test('preserves numbers', () => {
    expect(normalizeForComparison("John 3:16")).toBe("john 316");
  });
});

describe('getTodayDateString', () => {
  test('formats date as YYYY-MM-DD', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(getTodayDateString(date)).toBe("2024-01-15");
  });

  test('pads single-digit months', () => {
    const date = new Date(2024, 2, 5); // Mar 5, 2024
    expect(getTodayDateString(date)).toBe("2024-03-05");
  });

  test('handles December', () => {
    const date = new Date(2024, 11, 25); // Dec 25, 2024
    expect(getTodayDateString(date)).toBe("2024-12-25");
  });
});

describe('seededRandom', () => {
  test('returns same value for same seed', () => {
    const result1 = seededRandom("2024-01-15");
    const result2 = seededRandom("2024-01-15");
    expect(result1).toBe(result2);
  });

  test('returns different values for different seeds', () => {
    const result1 = seededRandom("2024-01-15");
    const result2 = seededRandom("2024-01-16");
    expect(result1 !== result2).toBeTruthy();
  });

  test('returns positive integer', () => {
    const result = seededRandom("test");
    expect(result >= 0).toBeTruthy();
    expect(Number.isInteger(result)).toBeTruthy();
  });
});

describe('classifyVerseLength', () => {
  test('classifies short verses', () => {
    expect(classifyVerseLength("x".repeat(50))).toBe("short");
    expect(classifyVerseLength("x".repeat(110))).toBe("short");
  });

  test('classifies medium verses', () => {
    expect(classifyVerseLength("x".repeat(111))).toBe("medium");
    expect(classifyVerseLength("x".repeat(230))).toBe("medium");
  });

  test('classifies long verses', () => {
    expect(classifyVerseLength("x".repeat(231))).toBe("long");
    expect(classifyVerseLength("x".repeat(500))).toBe("long");
  });

  test('trims whitespace before measuring', () => {
    expect(classifyVerseLength("  " + "x".repeat(50) + "  ")).toBe("short");
  });
});

describe('levenshteinDistance', () => {
  test('returns 0 for identical strings', () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
  });

  test('returns length for empty vs non-empty', () => {
    expect(levenshteinDistance("", "hello")).toBe(5);
    expect(levenshteinDistance("hello", "")).toBe(5);
  });

  test('counts single character difference', () => {
    expect(levenshteinDistance("hello", "hallo")).toBe(1);
  });

  test('counts insertions', () => {
    expect(levenshteinDistance("hello", "helloo")).toBe(1);
  });

  test('counts deletions', () => {
    expect(levenshteinDistance("hello", "helo")).toBe(1);
  });

  test('handles completely different strings', () => {
    expect(levenshteinDistance("abc", "xyz")).toBe(3);
  });
});

describe('computeFairnessScore', () => {
  test('returns 100% for perfect match', () => {
    const result = computeFairnessScore("Hello world", "Hello world");
    expect(result.scorePercent).toBe(100);
  });

  test('returns 100% for match with different case', () => {
    const result = computeFairnessScore("Hello World", "hello world");
    expect(result.scorePercent).toBe(100);
  });

  test('returns 100% for match with different punctuation', () => {
    const result = computeFairnessScore("Hello, world!", "hello world");
    expect(result.scorePercent).toBe(100);
  });

  test('returns 0% for empty truth', () => {
    const result = computeFairnessScore("", "hello");
    expect(result.scorePercent).toBe(0);
  });

  test('penalizes errors', () => {
    const result = computeFairnessScore("hello", "hallo");
    expect(result.scorePercent).toBeLessThan(100);
    expect(result.scorePercent).toBeGreaterThan(0);
  });

  test('handles missing words', () => {
    const result = computeFairnessScore("hello world", "hello");
    expect(result.scorePercent).toBeLessThan(100);
  });
});

describe('titleCase', () => {
  test('capitalizes first letter', () => {
    expect(titleCase("hello")).toBe("Hello");
  });

  test('lowercases rest of string', () => {
    expect(titleCase("HELLO")).toBe("Hello");
    expect(titleCase("hELLO")).toBe("Hello");
  });

  test('handles single character', () => {
    expect(titleCase("a")).toBe("A");
  });
});

// ============================================
// Summary
// ============================================

console.log('\n' + '='.repeat(50));
console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => {
    console.log(`  - ${f.name}: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
  process.exit(0);
}
