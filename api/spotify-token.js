import { createSpotifyTokenResult } from "../server/spotifyToken.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res
      .status(405)
      .json({
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." },
      });
    return;
  }

  try {
    const result = await createSpotifyTokenResult();
    res.setHeader("Cache-Control", "no-store");
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(500).json({
      error: {
        code: "TOKEN_HANDLER_ERROR",
        message: error.message || "Unexpected Spotify token error.",
      },
    });
  }
}
