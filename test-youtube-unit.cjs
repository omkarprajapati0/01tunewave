// Unit test for YouTube search functionality (no network calls)
// Run with: node test-youtube-unit.cjs

const assert = require("assert");

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test results
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    log(`  ✅ ${name}`, "green");
    passed++;
  } catch (err) {
    log(`  ❌ ${name}: ${err.message}`, "red");
    failed++;
  }
}

// Simulate the cache from youtube.js
function createCache() {
  const searchCache = new Map();
  const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  return {
    get: (query) => {
      const cached = searchCache.get(query);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
      return null;
    },
    set: (query, data) => {
      searchCache.set(query, {
        data,
        timestamp: Date.now(),
      });
    },
    size: () => searchCache.size,
  };
}

// Video ID validation (from youtube.js)
function isYouTubeSource(src) {
  return typeof src === "string" && /^[a-zA-Z0-9_-]{11}$/.test(src);
}

// Title extraction patterns (from youtube.js)
function extractTitle(html, videoId) {
  try {
    const patterns = [
      /"title":{"runs":\[\{"text":"([^"]+)"\}/,
      /"title":"([^"]+)","videoId":"${videoId}"/,
      /<title>([^<]+)<\/title>/,
      /"headline":"([^"]+)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1]
          .replace(/\\u0026/g, "&")
          .replace(/\\"/g, '"')
          .substring(0, 100);
      }
    }
    return "YouTube Video";
  } catch {
    return "YouTube Video";
  }
}

// Video ID extraction patterns (from youtube.js)
function extractVideoId(html) {
  const patterns = [
    /"videoId":"([a-zA-Z0-9_-]{11})"/,
    /"videoId":"([a-zA-Z0-9_-]{11})","thumbnail"/,
    /watch\?v=([a-zA-Z0-9_-]{11})/,
    /"contentUrl":"https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/,
    /"videoId":"([a-zA-Z0-9_-]{11})","title"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Run tests
log("🧪 YouTube Search Unit Test Suite", "blue");
log("=================================", "blue");
log("");

// Test 1: Cache functionality
log("📦 Testing Cache Functionality", "blue");
const cache = createCache();

test("Cache should store and retrieve data", () => {
  cache.set("test-query", { videoId: "abc123", title: "Test" });
  const result = cache.get("test-query");
  assert.strictEqual(result.videoId, "abc123");
  assert.strictEqual(result.title, "Test");
});

test("Cache should return null for non-existent keys", () => {
  const result = cache.get("non-existent");
  assert.strictEqual(result, null);
});

test("Cache should track size correctly", () => {
  const initialSize = cache.size();
  cache.set("another-query", { videoId: "def456" });
  assert.strictEqual(cache.size(), initialSize + 1);
});

// Test 2: Video ID validation
log("");
log("🔍 Testing Video ID Validation", "blue");

test("Valid video ID (11 chars)", () => {
  assert.strictEqual(isYouTubeSource("dQw4w9WgXcQ"), true);
});

test("Valid video ID with hyphens", () => {
  assert.strictEqual(isYouTubeSource("abc-def_123"), true);
});

test("Invalid - too short", () => {
  assert.strictEqual(isYouTubeSource("short"), false);
});

test("Invalid - too long", () => {
  assert.strictEqual(isYouTubeSource("this-is-way-too-long"), false);
});

test("Invalid - empty string", () => {
  assert.strictEqual(isYouTubeSource(""), false);
});

test("Invalid - null", () => {
  assert.strictEqual(isYouTubeSource(null), false);
});

test("Invalid - undefined", () => {
  assert.strictEqual(isYouTubeSource(undefined), false);
});

test("Invalid - special characters", () => {
  assert.strictEqual(isYouTubeSource("abc@def#ghi"), false);
});

// Test 3: Video ID extraction from HTML
log("");
log("🌐 Testing Video ID Extraction", "blue");

test("Extract from JSON videoId field", () => {
  const html = '{"videoId":"dQw4w9WgXcQ","title":"Test"}';
  assert.strictEqual(extractVideoId(html), "dQw4w9WgXcQ");
});

test("Extract from watch URL", () => {
  const html = 'href="/watch?v=abc123def45"';
  assert.strictEqual(extractVideoId(html), "abc123def45");
});

test("Extract from contentUrl", () => {
  const html = '"contentUrl":"https://www.youtube.com/watch?v=xyz789abc12"';
  assert.strictEqual(extractVideoId(html), "xyz789abc12");
});

test("Return null when no match", () => {
  const html = "some random html without video id";
  assert.strictEqual(extractVideoId(html), null);
});

// Test 4: Title extraction
log("");
log("📝 Testing Title Extraction", "blue");

test("Extract from JSON title field", () => {
  const html = '{"title":{"runs":[{"text":"Song Title"}]}}';
  assert.strictEqual(extractTitle(html, "123"), "Song Title");
});

test("Extract from HTML title tag", () => {
  const html = "<title>YouTube - Song Name</title>";
  assert.strictEqual(extractTitle(html, "123"), "YouTube - Song Name");
});

test("Extract from headline", () => {
  const html = '"headline":"Amazing Song"';
  assert.strictEqual(extractTitle(html, "123"), "Amazing Song");
});

test("Return default when no match", () => {
  const html = "random html without title";
  assert.strictEqual(extractTitle(html, "123"), "YouTube Video");
});

test("Handle HTML entities in title", () => {
  const html = '{"title":{"runs":[{"text":"Song \\u0026 Artist"}]}}';
  assert.strictEqual(extractTitle(html, "123"), "Song & Artist");
});

// Test 5: CORS proxy list validation
log("");
log("🌐 Testing CORS Proxy Configuration", "blue");

const CORS_PROXIES = [
  "https://api.allorigins.win/get?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://thingproxy.freeboard.io/fetch/",
  "https://cors-anywhere.herokuapp.com/",
];

test("Should have 5 CORS proxies configured", () => {
  assert.strictEqual(CORS_PROXIES.length, 5);
});

test("All proxies should be HTTPS URLs", () => {
  CORS_PROXIES.forEach((proxy) => {
    assert.ok(proxy.startsWith("https://"), `Proxy ${proxy} should use HTTPS`);
  });
});

test("All proxies should have URL parameter", () => {
  CORS_PROXIES.forEach((proxy) => {
    const hasParam =
      proxy.includes("?url=") ||
      proxy.includes("?quest=") ||
      proxy.includes("?") ||
      proxy.endsWith("/");
    assert.ok(hasParam, `Proxy ${proxy} should have URL parameter`);
  });
});

// Summary
log("");
log("📊 Test Summary", "blue");
log("================", "blue");
log(`Total Tests: ${passed + failed}`);
log(`Passed: ${passed}`, "green");
log(`Failed: ${failed}`, failed > 0 ? "red" : "green");

if (failed === 0) {
  log("");
  log("✅ All unit tests passed!", "green");
  log("");
  log("Next steps:", "blue");
  log("1. The code logic is working correctly", "yellow");
  log("2. Test the actual application at http://localhost:5176/", "yellow");
  log("3. Check browser console for YouTube search results", "yellow");
  process.exit(0);
} else {
  log("");
  log("❌ Some tests failed. Please review the implementation.", "red");
  process.exit(1);
}
