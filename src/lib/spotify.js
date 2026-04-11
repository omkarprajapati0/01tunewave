// Spotify Web API Service
// Uses Client Credentials Flow (no user authentication required)

// Spotify API credentials - Replace with your own from developer.spotify.com
const SPOTIFY_CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID || "").trim();
const SPOTIFY_CLIENT_SECRET = (
  import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || ""
).trim();
const IS_DEV = import.meta.env.DEV;

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const DEBUG_API_LOGS = import.meta.env.VITE_DEBUG_API === "true";
const REQUEST_CACHE_TTL_MS = 15000;
const SPOTIFY_DEFAULT_MARKET = (import.meta.env.VITE_SPOTIFY_MARKET || "IN")
  .toString()
  .trim()
  .toUpperCase();
const SPOTIFY_REQUEST_TIMEOUT_MS = 12000;
const SPOTIFY_MAX_RETRIES = 2;

const debugLog = (...args) => {
  if (DEBUG_API_LOGS) {
    console.log(...args);
  }
};

// Token management
let accessToken = null;
let tokenExpiry = null;
let lastError = null;
let hasWarnedMissingConfig = false;
let tokenPromise = null;

// Request dedupe/cache for GET endpoints
const requestCache = new Map();
const inFlightRequests = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const normalizeMarket = (market) => {
  const value = (market || SPOTIFY_DEFAULT_MARKET || "US")
    .toString()
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : "US";
};

/**
 * Check if Spotify credentials are properly configured
 * @returns {object} Configuration status
 */
export const checkSpotifyConfig = () => {
  const hasClientId = !!SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_ID.length > 10;
  const hasClientSecret =
    !!SPOTIFY_CLIENT_SECRET && SPOTIFY_CLIENT_SECRET.length > 10;
  const isConfigured = hasClientId && hasClientSecret;

  if (!isConfigured && !hasWarnedMissingConfig) {
    hasWarnedMissingConfig = true;
    if (IS_DEV) {
      console.warn("⚠️ Spotify API credentials not configured properly");
      if (!hasClientId) console.warn("   - Missing VITE_SPOTIFY_CLIENT_ID");
      if (!hasClientSecret)
        console.warn("   - Missing VITE_SPOTIFY_CLIENT_SECRET");
    }
  }

  return {
    isConfigured,
    hasClientId,
    hasClientSecret,
    clientIdPrefix: hasClientId
      ? SPOTIFY_CLIENT_ID.substring(0, 8) + "..."
      : null,
  };
};

/**
 * Get access token using Client Credentials Flow
 * @returns {Promise<string>} Access token
 */
export const getAccessToken = async () => {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  // Reuse in-flight token request to avoid duplicate auth calls
  if (tokenPromise) {
    return tokenPromise;
  }

  tokenPromise = (async () => {
    // Check configuration first
    const config = checkSpotifyConfig();
    if (!config.isConfigured) {
      const error = new Error(
        "Spotify API credentials not configured. Please add VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_CLIENT_SECRET to your .env file.",
      );
      error.code = "CREDENTIALS_MISSING";
      throw error;
    }

    try {
      debugLog("🔑 Requesting Spotify access token...");
      const credentials = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);

      const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      if (!response.ok) {
        await response.text();
        let errorMessage = `Failed to get access token: ${response.status}`;

        // Provide specific error messages for common issues
        if (response.status === 401) {
          errorMessage =
            "Invalid Spotify credentials. Please check your Client ID and Client Secret.";
        } else if (response.status === 403) {
          errorMessage =
            "Spotify API access denied. Your app may not have the required permissions.";
        } else if (response.status === 429) {
          errorMessage =
            "Rate limited by Spotify API. Please wait a moment and try again.";
        }

        const error = new Error(errorMessage);
        error.code = `HTTP_${response.status}`;
        error.status = response.status;
        throw error;
      }

      const data = await response.json();

      // Cache token with expiry (subtract 60 seconds for safety margin)
      accessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

      debugLog("✅ Spotify access token obtained successfully");

      return accessToken;
    } catch (error) {
      if (IS_DEV) {
        console.error("❌ Error getting Spotify access token:", error.message);
      }
      lastError = error;
      throw error;
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
};

/**
 * Make API request to Spotify
 * @param {string} endpoint - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise<object>} API response
 */
const spotifyFetch = async (endpoint, options = {}) => {
  const method = (options.method || "GET").toUpperCase();
  const cacheKey = method === "GET" ? endpoint : null;

  if (cacheKey) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < REQUEST_CACHE_TTL_MS) {
      return cached.data;
    }

    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const requestPromise = (async () => {
    const token = await getAccessToken();

    let response = null;
    let lastFetchError = null;

    for (let attempt = 0; attempt <= SPOTIFY_MAX_RETRIES; attempt += 1) {
      try {
        response = await fetchWithTimeout(
          `${SPOTIFY_API_BASE}${endpoint}`,
          {
            ...options,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              ...options.headers,
            },
          },
          SPOTIFY_REQUEST_TIMEOUT_MS,
        );
      } catch (fetchError) {
        lastFetchError = fetchError;
        const canRetry = attempt < SPOTIFY_MAX_RETRIES;
        if (!canRetry) {
          const error = new Error(
            "Spotify request failed due to network timeout. Please try again.",
          );
          error.code = "SPOTIFY_NETWORK_TIMEOUT";
          throw error;
        }

        await delay(350 * (attempt + 1));
        continue;
      }

      if (
        response.ok ||
        ![429, 500, 502, 503, 504].includes(response.status) ||
        attempt === SPOTIFY_MAX_RETRIES
      ) {
        break;
      }

      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterMs = Number.parseInt(retryAfterHeader || "0", 10) * 1000;
      const backoffMs = Math.max(500 * (attempt + 1), retryAfterMs || 0);
      await delay(backoffMs);
    }

    if (!response) {
      throw lastFetchError || new Error("Spotify request failed");
    }

    if (!response.ok) {
      // Log the full error for debugging
      const errorText = await response.text().catch(() => "Unknown error");
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }

      debugLog(
        `❌ Spotify API error (${response.status}) for ${endpoint}:`,
        errorData,
      );

      // Return null for 404 errors instead of throwing, to allow graceful fallback
      if (response.status === 404) {
        if (cacheKey) {
          requestCache.set(cacheKey, { data: null, timestamp: Date.now() });
        }
        return null;
      }

      // Provide user-friendly error messages
      let errorMessage =
        errorData.error?.message || `Spotify API error: ${response.status}`;

      if (response.status === 401) {
        errorMessage = "Spotify session expired. Please refresh the page.";
        // Clear token to force re-authentication
        accessToken = null;
        tokenExpiry = null;
      } else if (response.status === 403) {
        errorMessage =
          "Access denied. This feature may not be available in your region.";
      } else if (response.status === 429) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
      } else if (response.status >= 500) {
        errorMessage =
          "Spotify service is temporarily unavailable. Please try again later.";
      }

      const error = new Error(errorMessage);
      error.code = `HTTP_${response.status}`;
      error.status = response.status;
      throw error;
    }

    const responseData = await response.json();

    if (cacheKey) {
      requestCache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now(),
      });
    }

    return responseData;
  })();

  if (cacheKey) {
    inFlightRequests.set(cacheKey, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (cacheKey) {
      inFlightRequests.delete(cacheKey);
    }
  }
};

/**
 * Search Spotify for tracks, artists, albums, or playlists
 * @param {string} query - Search query
 * @param {string} types - Types to search for (comma-separated)
 * @param {number} limit - Number of results
 * @param {number} offset - Number of results to skip (for pagination)
 * @returns {Promise<object>} Search results
 */
export const searchSpotify = async (
  query,
  types = "track,artist,album,playlist",
  limit = 20,
  offset = 0,
  market = SPOTIFY_DEFAULT_MARKET,
) => {
  const normalizedMarket = normalizeMarket(market);
  const params = new URLSearchParams({
    q: query,
    type: types,
    limit: limit.toString(),
    offset: offset.toString(),
    market: normalizedMarket,
    include_external: "audio",
  });

  const primaryResults = await spotifyFetch(`/search?${params}`);

  const trackItems = primaryResults?.tracks?.items || [];
  const isTrackOnlySearch = types === "track";
  const shouldRetryWithFallbackMarket =
    isTrackOnlySearch && trackItems.length === 0 && normalizedMarket !== "US";

  if (shouldRetryWithFallbackMarket) {
    const fallbackParams = new URLSearchParams({
      q: query,
      type: types,
      limit: limit.toString(),
      offset: offset.toString(),
      market: "US",
      include_external: "audio",
    });

    debugLog("No Spotify tracks found in market, retrying with US fallback");
    return spotifyFetch(`/search?${fallbackParams}`);
  }

  return primaryResults;
};

/**
 * Get Spotify tracks by IDs
 * @param {string|string[]} ids - Track ID(s)
 * @returns {Promise<object>} Track details
 */
export const getTracks = async (ids) => {
  const idList = Array.isArray(ids) ? ids.join(",") : ids;
  return spotifyFetch(`/tracks?ids=${idList}`);
};

/**
 * Get Spotify track details by ID
 * @param {string} id - Track ID
 * @returns {Promise<object>} Track details
 */
export const getTrack = async (id) => {
  return spotifyFetch(`/tracks/${id}`);
};

/**
 * Get Spotify playlists
 * @param {string} playlistId - Playlist ID
 * @returns {Promise<object>} Playlist details
 */
export const getPlaylist = async (playlistId) => {
  return spotifyFetch(`/playlists/${playlistId}`);
};

/**
 * Get featured playlists
 * @param {string} country - Country code
 * @param {number} limit - Number of playlists
 * @returns {Promise<object>} Featured playlists
 */
export const getFeaturedPlaylists = async (country = "US", limit = 20) => {
  const params = new URLSearchParams({
    country,
    limit: limit.toString(),
  });

  try {
    const result = await spotifyFetch(`/browse/featured-playlists?${params}`);
    // Return null if 404 (endpoint not available for this app)
    if (result === null) {
      debugLog("Featured playlists not available, using fallback");
      return null;
    }
    return result;
  } catch (error) {
    debugLog("Featured playlists error:", error.message);
    return null;
  }
};

/**
 * Get category playlists
 * @param {string} categoryId - Category ID
 * @param {string} country - Country code
 * @param {number} limit - Number of playlists
 * @returns {Promise<object>} Category playlists
 */
export const getCategoryPlaylists = async (
  categoryId,
  country = "US",
  limit = 20,
) => {
  const params = new URLSearchParams({
    country,
    limit: limit.toString(),
  });

  return spotifyFetch(`/browse/categories/${categoryId}/playlists?${params}`);
};

/**
 * Get Spotify artist details
 * @param {string} id - Artist ID
 * @returns {Promise<object>} Artist details
 */
export const getArtist = async (id) => {
  return spotifyFetch(`/artists/${id}`);
};

/**
 * Get Spotify artists by IDs
 * @param {string|string[]} ids - Artist ID(s)
 * @returns {Promise<object>} Artist details
 */
export const getArtists = async (ids) => {
  const idList = Array.isArray(ids) ? ids.join(",") : ids;
  return spotifyFetch(`/artists?ids=${idList}`);
};

/**
 * Get artist's top tracks
 * @param {string} id - Artist ID
 * @param {string} country - Country code
 * @returns {Promise<object>} Top tracks
 */
export const getArtistTopTracks = async (id, country = "US") => {
  return spotifyFetch(`/artists/${id}/top-tracks?market=${country}`);
};

/**
 * Get related artists
 * @param {string} id - Artist ID
 * @returns {Promise<object>} Related artists
 */
export const getRelatedArtists = async (id) => {
  return spotifyFetch(`/artists/${id}/related-artists`);
};

/**
 * Get Spotify album details
 * @param {string} id - Album ID
 * @returns {Promise<object>} Album details
 */
export const getAlbum = async (id) => {
  return spotifyFetch(`/albums/${id}`);
};

/**
 * Get Spotify albums by IDs
 * @param {string|string[]} ids - Album ID(s)
 * @returns {Promise<object>} Album details
 */
export const getAlbums = async (ids) => {
  const idList = Array.isArray(ids) ? ids.join(",") : ids;
  return spotifyFetch(`/albums?ids=${idList}`);
};

/**
 * Get album tracks
 * @param {string} id - Album ID
 * @param {number} limit - Number of tracks
 * @returns {Promise<object>} Album tracks
 */
export const getAlbumTracks = async (id, limit = 50) => {
  return spotifyFetch(`/albums/${id}/tracks?limit=${limit}`);
};

/**
 * Get new releases
 * @param {string} country - Country code
 * @param {number} limit - Number of releases
 * @returns {Promise<object>} New releases
 */
export const getNewReleases = async (country = "US", limit = 20) => {
  const params = new URLSearchParams({
    country,
    limit: limit.toString(),
  });

  return spotifyFetch(`/browse/new-releases?${params}`);
};

/**
 * Get recommendations based on seeds
 * @param {object} options - Recommendation options
 * @returns {Promise<object>} Recommendations
 */
export const getRecommendations = async (options = {}) => {
  const params = new URLSearchParams({
    limit: options.limit?.toString() || "20",
    market: options.market || "US",
  });

  if (options.seed_artists) {
    params.append("seed_artists", options.seed_artists);
  }
  if (options.seed_genres) {
    params.append("seed_genres", options.seed_genres);
  }
  if (options.seed_tracks) {
    params.append("seed_tracks", options.seed_tracks);
  }
  if (options.target_energy) {
    params.append("target_energy", options.target_energy.toString());
  }
  if (options.target_valence) {
    params.append("target_valence", options.target_valence.toString());
  }

  return spotifyFetch(`/recommendations?${params}`);
};

/**
 * Get several tracks preview URLs (30 second previews)
 * @param {string|string[]} ids - Track ID(s)
 * @returns {Promise<object>} Track previews
 */
export const getTrackPreviews = async (ids) => {
  const idList = Array.isArray(ids) ? ids.join(",") : ids;
  return spotifyFetch(`/tracks?ids=${idList}`);
};

/**
 * Get Spotify categories
 * @param {string} country - Country code
 * @param {number} limit - Number of categories
 * @returns {Promise<object>} Categories
 */
export const getCategories = async (country = "US", limit = 50) => {
  const params = new URLSearchParams({
    country,
    limit: limit.toString(),
  });

  return spotifyFetch(`/browse/categories?${params}`);
};

/**
 * Get the last error that occurred
 * @returns {Error|null} Last error or null
 */
export const getLastError = () => lastError;

/**
 * Clear the last error
 */
export const clearLastError = () => {
  lastError = null;
};

/**
 * Reset token (useful for forcing re-authentication)
 */
export const resetToken = () => {
  accessToken = null;
  tokenExpiry = null;
  requestCache.clear();
  inFlightRequests.clear();
  debugLog("🔄 Spotify token reset");
};

export default {
  getAccessToken,
  checkSpotifyConfig,
  searchSpotify,
  getTracks,
  getTrack,
  getPlaylist,
  getFeaturedPlaylists,
  getCategoryPlaylists,
  getArtist,
  getArtists,
  getArtistTopTracks,
  getRelatedArtists,
  getAlbum,
  getAlbums,
  getAlbumTracks,
  getNewReleases,
  getRecommendations,
  getTrackPreviews,
  getCategories,
  getLastError,
  clearLastError,
  resetToken,
};
