import { createYouTubeSearchResult } from "../../server/youtubeSearch.js";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "GET",
      },
      body: JSON.stringify({
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." },
      }),
    };
  }

  try {
    const query = event.queryStringParameters?.q || "";
    const result = await createYouTubeSearchResult({ query });

    return {
      statusCode: result.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(result.body),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: {
          code: "YOUTUBE_SEARCH_HANDLER_ERROR",
          message: error.message || "Unexpected YouTube search error.",
        },
      }),
    };
  }
};
