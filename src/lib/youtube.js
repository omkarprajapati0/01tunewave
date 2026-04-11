// YouTube Search and Playback Service
// Uses YouTube IFrame API to play songs (audio-only mode)

// YouTube Data API v3 configuration
const YOUTUBE_API_KEY = (import.meta.env.VITE_YOUTUBE_API_KEY || "").trim();
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_EMBED_BASE = "https://www.youtube-nocookie.com/embed/";
const IS_DEV = import.meta.env.DEV;
const ENABLE_YOUTUBE_DATA_API =
  import.meta.env.VITE_ENABLE_YOUTUBE_DATA_API === "true";
const ENABLE_SCRAPE_FALLBACK = IS_DEV;
const ENABLE_EXTERNAL_PROXY_FALLBACK =
  import.meta.env.VITE_ENABLE_EXTERNAL_PROXY_FALLBACK === "true";
let youtubeApiForbiddenForSession = false;

// CORS proxy options for fallback scraping
// Local Vite proxy is most reliable, then fall back to public proxies
const getLocalProxyUrl = () => {
  // Use relative path - Vite proxy will handle it on whatever port the app is running
  return "/youtube-search";
};

const CORS_PROXIES = [
  getLocalProxyUrl, // Local Vite dev server proxy (most reliable) - function called dynamically
];

// Keep external proxies as backup but they'll only be used if local proxy fails
const FALLBACK_PROXIES = ENABLE_EXTERNAL_PROXY_FALLBACK
  ? ["https://api.allorigins.win/raw?url=", "https://corsproxy.io/?"]
  : [];

// Maximum retries for failed requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 1500; // 1.5 seconds

/**
 * Delay helper for retry logic
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if YouTube Data API is configured
 * @returns {boolean}
 */
export const isYouTubeAPIConfigured = () => {
  return (
    ENABLE_YOUTUBE_DATA_API && !!YOUTUBE_API_KEY && YOUTUBE_API_KEY.length > 10
  );
};

/**
 * Search YouTube using Data API v3 (primary method)
 * @param {string} query - Search query
 * @returns {Promise<object>} YouTube video info
 */
const searchYouTubeAPI = async (query) => {
  if (youtubeApiForbiddenForSession) {
    const forbiddenError = new Error(
      "YouTube API access forbidden for this session",
    );
    forbiddenError.status = 403;
    forbiddenError.code = "YOUTUBE_API_FORBIDDEN";
    throw forbiddenError;
  }

  if (!isYouTubeAPIConfigured()) {
    throw new Error("YouTube API key not configured");
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoEmbeddable: "true",
    maxResults: "5",
    key: YOUTUBE_API_KEY,
  });

  const response = await fetch(`${YOUTUBE_API_BASE}/search?${params}`);

  if (!response.ok) {
    if (response.status === 403) {
      youtubeApiForbiddenForSession = true;
      const forbiddenError = new Error(
        "YouTube API key is forbidden (403). Check API restrictions/quota and enable YouTube Data API v3.",
      );
      forbiddenError.status = 403;
      forbiddenError.code = "YOUTUBE_API_FORBIDDEN";
      throw forbiddenError;
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `YouTube API error: ${response.status}`,
    );
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return { success: false, error: "No results found" };
  }

  const video = data.items[0];
  return {
    videoId: video.id.videoId,
    title: video.snippet.title,
    thumbnail: video.snippet.thumbnails?.medium?.url,
    success: true,
    method: "api",
  };
};

// Simple in-memory cache for search results
const searchCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const failedSearchCache = new Map();
const FAILED_CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

/**
 * Get cached search result
 */
const getCachedResult = (query) => {
  const cached = searchCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log("  📦 Using cached result for:", query);
    return cached.data;
  }
  return null;
};

/**
 * Cache search result
 */
const setCachedResult = (query, data) => {
  searchCache.set(query, {
    data,
    timestamp: Date.now(),
  });
};

const getCachedFailure = (query) => {
  const cached = failedSearchCache.get(query);
  if (cached && Date.now() - cached.timestamp < FAILED_CACHE_DURATION) {
    return cached.data;
  }
  if (cached) {
    failedSearchCache.delete(query);
  }
  return null;
};

const setCachedFailure = (query, data) => {
  failedSearchCache.set(query, {
    data,
    timestamp: Date.now(),
  });
};

/**
 * Search YouTube using scraping with CORS proxy fallback
 * @param {string} query - Search query
 * @param {number} proxyIndex - Current proxy index to try
 * @returns {Promise<object>} YouTube video info
 */
const searchYouTubeScrape = async (query, proxyIndex = 0) => {
  // Check cache first
  const cached = getCachedResult(query);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  // Build URLs to try - skip direct fetch in browser due to CORS
  const combinedProxies = [
    ...CORS_PROXIES.slice(proxyIndex),
    ...FALLBACK_PROXIES,
  ];

  const urlsToTry = combinedProxies.map((proxy) => {
    // Local Vite proxy is a function, call it to get the URL
    if (typeof proxy === "function") {
      return `${proxy()}?search_query=${encodeURIComponent(query)}`;
    }
    // Some external proxies need the URL encoded differently
    if (proxy.includes("allorigins.win")) {
      return proxy + encodeURIComponent(searchUrl);
    }
    return proxy + searchUrl;
  });

  for (let i = 0; i < urlsToTry.length; i++) {
    try {
      console.log(`  → Trying proxy ${i + 1}/${urlsToTry.length}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(urlsToTry[i], {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          DNT: "1",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (IS_DEV) {
          console.warn(`  ⚠️ Proxy ${i + 1} returned status:`, response.status);
        }
        continue;
      }

      const html = await response.text();

      // Check if we got a valid HTML response
      if (!html || html.length < 1000) {
        if (IS_DEV) {
          console.warn(`  ⚠️ Proxy ${i + 1} returned invalid/empty response`);
        }
        continue;
      }

      // Try multiple patterns to extract video ID
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
          const result = {
            videoId: match[1],
            title: extractTitle(html),
            success: true,
            method: "scrape",
          };
          console.log("  ✅ Found via scraping:", result.videoId);
          // Cache the result
          setCachedResult(query, result);
          return result;
        }
      }

      if (IS_DEV) {
        console.warn(
          `  ⚠️ Could not extract video ID from proxy ${i + 1} response`,
        );
      }
    } catch (error) {
      if (error.name === "AbortError") {
        if (IS_DEV) {
          console.warn(`  ⏱️ Proxy ${i + 1} timed out`);
        }
      } else {
        if (IS_DEV) {
          console.warn(`  ⚠️ Proxy ${i + 1} failed:`, error.message);
        }
      }
      continue;
    }
  }

  return {
    success: false,
    error: "All CORS proxies failed. YouTube search unavailable.",
    isNetworkError: true,
  };
};

/**
 * Search YouTube for a video and get the best match
 * Tries multiple methods: API -> Scraping with proxies
 * @param {string} query - Search query (song name + artist)
 * @param {number} retryCount - Current retry attempt (internal use)
 * @returns {Promise<object>} YouTube video info
 */
export const searchYouTube = async (query, retryCount = 0) => {
  console.log(`🔍 Searching YouTube for: "${query}"`);

  const failedCached = getCachedFailure(query);
  if (failedCached) {
    return failedCached;
  }

  try {
    // Method 1: Try YouTube Data API if configured
    if (isYouTubeAPIConfigured()) {
      try {
        console.log("  → Trying YouTube Data API...");
        const result = await searchYouTubeAPI(query);
        if (result.success) {
          console.log("  ✅ Found via YouTube API:", result.videoId);
          return result;
        }
      } catch (apiError) {
        if (IS_DEV) {
          console.warn("  ⚠️ YouTube API failed:", apiError.message);
        }
        // Continue to fallback
      }
    } else {
      if (ENABLE_SCRAPE_FALLBACK) {
        console.log(
          "  ℹ️ YouTube API key not configured, using fallback methods",
        );
      } else {
        console.log(
          "  ℹ️ YouTube API key not configured; scraping fallback is disabled in production",
        );
      }
    }

    // Production should not use scraping proxies to avoid CORS/404 spam and latency.
    if (!ENABLE_SCRAPE_FALLBACK) {
      const result = {
        success: false,
        error: youtubeApiForbiddenForSession
          ? "YouTube API key is blocked (403)."
          : "YouTube search unavailable in production without VITE_YOUTUBE_API_KEY.",
        isNetworkError: false,
      };
      setCachedFailure(query, result);
      return result;
    }

    // Method 2: Try scraping with CORS proxies
    console.log("  → Trying scraping method...");
    const scrapeResult = await searchYouTubeScrape(query);

    if (scrapeResult.success) {
      console.log("  ✅ Found via scraping:", scrapeResult.videoId);
      return scrapeResult;
    }

    // If scraping failed due to network/CORS, retry
    if (scrapeResult.isNetworkError && retryCount < MAX_RETRIES && IS_DEV) {
      console.log(
        `  🔄 Retrying in ${RETRY_DELAY}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
      );
      await delay(RETRY_DELAY * (retryCount + 1));
      return searchYouTube(query, retryCount + 1);
    }

    if (IS_DEV) {
      console.error("  ❌ YouTube search failed - no results found");
    }
    const result = {
      success: false,
      error: "Could not find any YouTube videos for this search",
      isNetworkError: scrapeResult.isNetworkError,
    };
    setCachedFailure(query, result);
    return result;
  } catch (error) {
    if (IS_DEV) {
      console.error(`  ❌ YouTube search error:`, error.message);
    }

    // Retry logic for unexpected errors
    if (retryCount < MAX_RETRIES && IS_DEV) {
      console.log(`  🔄 Retrying in ${RETRY_DELAY}ms...`);
      await delay(RETRY_DELAY * (retryCount + 1));
      return searchYouTube(query, retryCount + 1);
    }

    const result = {
      success: false,
      error: error.message,
      isNetworkError: true,
    };
    setCachedFailure(query, result);
    return result;
  }
};

/**
 * Extract video title from YouTube search results HTML
 */
const extractTitle = (html) => {
  try {
    // Try multiple patterns to find the title
    const patterns = [
      /"title":{"runs":\[\{"text":"([^"]+)"\}/,
      /"title":"([^"]+)","videoId":"${videoId}"/,
      /<title>([^<]+)<\/title>/,
      /"headline":"([^"]+)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        // Clean up the title
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
};

/**
 * Get YouTube embed URL for a video ID
 */
export const getYouTubeEmbedUrl = (videoId, autoplay = false) => {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    controls: "1",
    disablekb: "1",
    fs: "0",
    modestbranding: "1",
    rel: "0",
    showinfo: "0",
    iv_load_policy: "3",
    // Audio-only mode parameters
    ecver: "2",
  });

  return `${YOUTUBE_EMBED_BASE}${videoId}?${params.toString()}`;
};

/**
 * Create a song object from YouTube search results
 * @param {string} songName - Song name
 * @param {string} artistName - Artist name
 * @returns {Promise<object|null>} Song object with YouTube source, or null if search fails
 */
export const searchAndCreateSong = async (songName, artistName) => {
  const query = `${songName} ${artistName} official audio`;
  const result = await searchYouTube(query);

  if (result.success) {
    console.log(
      `✅ YouTube search successful for: ${songName} - ${artistName}`,
    );
    return {
      title: songName,
      artist: artistName,
      src: result.videoId, // Store video ID for YouTube playback
      srcType: "youtube",
      cover: `https://img.youtube.com/vi/${result.videoId}/mqdefault.jpg`,
      duration: 0, // YouTube doesn't provide duration in this method
      source: "youtube",
      youtubeTitle: result.title,
    };
  }

  // Log the failure but return null gracefully
  if (result.isNetworkError) {
    if (IS_DEV) {
      console.error(
        `❌ Network error searching YouTube for: ${songName} - ${artistName}`,
      );
    }
  } else {
    if (IS_DEV) {
      console.error(
        `❌ No YouTube results found for: ${songName} - ${artistName}`,
      );
    }
  }

  return null;
};

/**
 * Check if a source is a YouTube video ID
 */
export const isYouTubeSource = (src) => {
  return typeof src === "string" && /^[a-zA-Z0-9_-]{11}$/.test(src);
};

/**
 * Get YouTube thumbnail URL
 */
export const getYouTubeThumbnail = (videoId, quality = "mqdefault") => {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
};

export default {
  searchYouTube,
  getYouTubeEmbedUrl,
  searchAndCreateSong,
  isYouTubeSource,
  getYouTubeThumbnail,
};
