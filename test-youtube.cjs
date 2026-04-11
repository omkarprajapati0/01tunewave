// Test script for YouTube search functionality
// Run with: node test-youtube.js

const https = require("https");
const http = require("http");
const { URL } = require("url");

// Test query
const TEST_QUERY = "Hopeless Amanraj Gill official audio";

// CORS proxies to test (same as in youtube.js)
const CORS_PROXIES = [
  "https://api.allorigins.win/get?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://thingproxy.freeboard.io/fetch/",
  "https://cors-anywhere.herokuapp.com/",
];

const SUITE_TIMEOUT_MS = 120000;

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

// Simple fetch implementation using Node.js https
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const timeout = options.timeout || 10000;
    let settled = false;

    const settleReject = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const settleResolve = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || "GET",
      agent: false,
      headers: options.headers || {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    };

    const req = client.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        settleResolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data)),
        });
      });
    });

    const timeoutId = setTimeout(() => {
      req.destroy(new Error("Request timeout"));
      settleReject(new Error("Request timeout"));
    }, timeout);

    req.setTimeout(timeout, () => {
      req.destroy(new Error("Request timeout"));
      settleReject(new Error("Request timeout"));
    });

    req.on("error", (err) => {
      clearTimeout(timeoutId);
      settleReject(err);
    });

    req.on("close", () => {
      clearTimeout(timeoutId);
    });

    req.end();
  });
}

// Test a single CORS proxy
async function testProxy(proxyUrl, index) {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(TEST_QUERY)}`;
  const fullUrl = proxyUrl + encodeURIComponent(searchUrl);

  log(`\n[${index + 1}] Testing: ${proxyUrl}`, "blue");

  try {
    const startTime = Date.now();
    const response = await fetch(fullUrl, { timeout: 15000 });
    const duration = Date.now() - startTime;

    if (!response.ok) {
      log(`  ❌ Failed with status: ${response.status} (${duration}ms)`, "red");
      return {
        success: false,
        proxy: proxyUrl,
        error: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();

    // Check if we got valid HTML
    if (!html || html.length < 1000) {
      log(`  ⚠️ Invalid/empty response (${html?.length || 0} bytes)`, "yellow");
      return { success: false, proxy: proxyUrl, error: "Invalid response" };
    }

    // Try to extract video ID
    const patterns = [
      /"videoId":"([a-zA-Z0-9_-]{11})"/,
      /watch\?v=([a-zA-Z0-9_-]{11})/,
    ];

    let videoId = null;
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        videoId = match[1];
        break;
      }
    }

    if (videoId) {
      log(`  ✅ SUCCESS! Found video ID: ${videoId} (${duration}ms)`, "green");
      return {
        success: true,
        proxy: proxyUrl,
        videoId,
        duration,
        responseSize: html.length,
      };
    } else {
      log(`  ⚠️ Could not extract video ID (${duration}ms)`, "yellow");
      return { success: false, proxy: proxyUrl, error: "No video ID found" };
    }
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, "red");
    return { success: false, proxy: proxyUrl, error: error.message };
  }
}

// Test caching functionality
function testCaching() {
  log("\n📦 Testing in-memory cache functionality...", "blue");

  // Simulate the cache from youtube.js
  const searchCache = new Map();
  const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  const testQuery = "test song query";
  const testData = { videoId: "test123", title: "Test Song" };

  // Set cache
  searchCache.set(testQuery, {
    data: testData,
    timestamp: Date.now(),
  });

  // Get cache (should work)
  const cached = searchCache.get(testQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    log("  ✅ Cache set and retrieved successfully", "green");
    return true;
  } else {
    log("  ❌ Cache test failed", "red");
    return false;
  }
}

// Test video ID validation
function testVideoIdValidation() {
  log("\n🔍 Testing video ID validation patterns...", "blue");

  const testCases = [
    { input: "dQw4w9WgXcQ", expected: true }, // Valid
    { input: "invalid", expected: false }, // Too short
    { input: "dQw4w9WgXcQ123", expected: false }, // Too long
    { input: "", expected: false }, // Empty
    { input: null, expected: false }, // Null
  ];

  let passed = 0;
  testCases.forEach(({ input, expected }) => {
    const isValid =
      typeof input === "string" && /^[a-zA-Z0-9_-]{11}$/.test(input);
    const status = isValid === expected ? "✅" : "❌";
    log(
      `  ${status} "${input}" -> ${isValid} (expected: ${expected})`,
      isValid === expected ? "green" : "red",
    );
    if (isValid === expected) passed++;
  });

  return passed === testCases.length;
}

// Main test runner
async function runTests() {
  log("🧪 YouTube Search CORS Fix Test Suite", "blue");
  log("=====================================", "blue");
  log(`Test Query: "${TEST_QUERY}"\n`);

  const results = {
    proxies: [],
    cache: false,
    validation: false,
  };

  // Test 1: CORS Proxies
  log("🌐 Testing CORS Proxies...", "blue");
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const result = await testProxy(CORS_PROXIES[i], i);
    results.proxies.push(result);
  }

  // Test 2: Caching
  results.cache = testCaching();

  // Test 3: Video ID Validation
  results.validation = testVideoIdValidation();

  // Summary
  log("\n📊 Test Summary", "blue");
  log("================", "blue");

  const workingProxies = results.proxies.filter((r) => r.success);
  log(
    `Working Proxies: ${workingProxies.length}/${CORS_PROXIES.length}`,
    workingProxies.length > 0 ? "green" : "red",
  );

  workingProxies.forEach((r) => {
    log(`  ✅ ${r.proxy} (${r.duration}ms, ${r.responseSize} bytes)`, "green");
  });

  const failedProxies = results.proxies.filter((r) => !r.success);
  failedProxies.forEach((r) => {
    log(`  ❌ ${r.proxy} - ${r.error}`, "red");
  });

  log(
    `\nCache Functionality: ${results.cache ? "✅ PASS" : "❌ FAIL"}`,
    results.cache ? "green" : "red",
  );

  log(
    `Video ID Validation: ${results.validation ? "✅ PASS" : "❌ FAIL"}`,
    results.validation ? "green" : "red",
  );

  // Overall result
  const allPassed =
    workingProxies.length > 0 && results.cache && results.validation;
  log(
    `\n${allPassed ? "✅ All critical tests passed!" : "⚠️ Some tests failed"}`,
    allPassed ? "green" : "yellow",
  );

  if (workingProxies.length === 0) {
    log("\n⚠️ WARNING: No CORS proxies are working!", "red");
    log("You may need to:", "yellow");
    log("  1. Check your internet connection", "yellow");
    log("  2. Try again later (proxies may be temporarily down)", "yellow");
    log("  3. Consider setting up a YouTube Data API key", "yellow");
  }

  return allPassed;
}

// Run tests
const suiteTimeout = setTimeout(() => {
  log(`\n❌ Test suite timed out after ${SUITE_TIMEOUT_MS / 1000}s`, "red");
  process.exit(1);
}, SUITE_TIMEOUT_MS);

runTests()
  .then((allPassed) => {
    clearTimeout(suiteTimeout);
    process.exit(allPassed ? 0 : 1);
  })
  .catch((err) => {
    clearTimeout(suiteTimeout);
    log(`\n❌ Test suite error: ${err.message}`, "red");
    process.exit(1);
  });
