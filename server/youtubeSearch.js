const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_SEARCH_BASE = "https://www.youtube.com/results";

const readEnvValue = (env, key) => (env?.[key] || "").toString().trim();

const getYouTubeApiKey = (env) => {
  return (
    readEnvValue(env, "YOUTUBE_API_KEY") ||
    readEnvValue(env, "VITE_YOUTUBE_API_KEY")
  );
};

const scrapeYouTubeSearch = async (query, fetchImpl) => {
  const params = new URLSearchParams({
    search_query: query,
  });

  const response = await fetchImpl(`${YOUTUBE_SEARCH_BASE}?${params}`, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
  if (!match?.[1]) {
    return null;
  }

  return {
    success: true,
    method: "scrape",
    videoId: match[1],
    title: "YouTube Video",
    thumbnail: `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`,
  };
};

export const createYouTubeSearchResult = async ({
  query,
  env = process.env,
  fetchImpl = fetch,
} = {}) => {
  const normalizedQuery = (query || "").toString().trim();
  if (!normalizedQuery) {
    return {
      status: 400,
      body: {
        error: {
          code: "QUERY_REQUIRED",
          message: "Missing query parameter q.",
        },
      },
    };
  }

  const apiKey = getYouTubeApiKey(env);
  if (!apiKey) {
    const scraped = await scrapeYouTubeSearch(normalizedQuery, fetchImpl);
    if (scraped) {
      return {
        status: 200,
        body: scraped,
      };
    }

    return {
      status: 500,
      body: {
        error: {
          code: "MISSING_YOUTUBE_API_KEY",
          message:
            "YouTube API key is not configured on the server. Set YOUTUBE_API_KEY or VITE_YOUTUBE_API_KEY.",
        },
      },
    };
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: normalizedQuery,
    type: "video",
    videoEmbeddable: "true",
    maxResults: "5",
    key: apiKey,
  });

  const response = await fetchImpl(`${YOUTUBE_API_BASE}/search?${params}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if ([403, 429, 500, 503].includes(response.status)) {
      const scraped = await scrapeYouTubeSearch(normalizedQuery, fetchImpl);
      if (scraped) {
        return {
          status: 200,
          body: scraped,
        };
      }
    }

    const apiMessage =
      data?.error?.message || `YouTube API error: ${response.status}`;
    return {
      status: response.status,
      body: {
        error: {
          code: `HTTP_${response.status}`,
          message: apiMessage,
        },
      },
    };
  }

  const first = data?.items?.[0];
  if (!first?.id?.videoId) {
    return {
      status: 200,
      body: {
        success: false,
        error: "No results found",
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      method: "api",
      videoId: first.id.videoId,
      title: first.snippet?.title || "YouTube Video",
      thumbnail: first.snippet?.thumbnails?.medium?.url || null,
    },
  };
};
