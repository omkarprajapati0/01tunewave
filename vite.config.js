import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createSpotifyTokenResult } from "./server/spotifyToken.js";

const spotifyDevPlugin = (env) => ({
  name: "spotify-token-dev-endpoint",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url !== "/api/spotify-token") {
        next();
        return;
      }

      if (req.method !== "GET") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET");
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "Method not allowed.",
            },
          }),
        );
        return;
      }

      try {
        const result = await createSpotifyTokenResult({ env });
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(result.body));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: {
              code: "TOKEN_HANDLER_ERROR",
              message: error.message || "Unexpected Spotify token error.",
            },
          }),
        );
      }
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url !== "/api/spotify-token") {
        next();
        return;
      }

      if (req.method !== "GET") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET");
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "Method not allowed.",
            },
          }),
        );
        return;
      }

      try {
        const result = await createSpotifyTokenResult({ env });
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(result.body));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: {
              code: "TOKEN_HANDLER_ERROR",
              message: error.message || "Unexpected Spotify token error.",
            },
          }),
        );
      }
    });
  },
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), spotifyDevPlugin(env)],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (
                id.includes("react") ||
                id.includes("react-dom") ||
                id.includes("react-router-dom")
              ) {
                return "react-vendor";
              }

              if (id.includes("@supabase")) {
                return "supabase-vendor";
              }

              return "vendor";
            }

            if (
              id.includes("src/lib/youtube") ||
              id.includes("src/components/player/YouTubePlayer") ||
              id.includes("src/pages/Spotify") ||
              id.includes("src/components/SpotifySearch")
            ) {
              return "media-search";
            }
          },
        },
      },
    },
    server: {
      port: 5181,
      strictPort: false, // Allow fallback to other ports if 5181 is taken
      proxy: {
        // Proxy YouTube search requests to bypass CORS
        "/youtube-search": {
          target: "https://www.youtube.com",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => {
            // Extract search query from path
            const url = new URL(path, "http://localhost");
            const searchParams = url.searchParams;
            const query = searchParams.get("search_query");
            if (query) {
              return `/results?search_query=${encodeURIComponent(query)}`;
            }
            return path.replace(/^\/youtube-search/, "/results");
          },
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
        // Proxy YouTube API requests
        "/youtube-api": {
          target: "https://www.googleapis.com",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/youtube-api/, ""),
        },
        // Proxy YouTube embed requests
        "/youtube-embed": {
          target: "https://www.youtube.com",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/youtube-embed/, ""),
        },
        // Proxy lyrics API requests to bypass CORS
        "/lyrics-api": {
          target: "https://api.lyrics.ovh",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/lyrics-api/, "/v1"),
        },
        // CORS proxy for direct lyrics API fallback
        "/lyrics-direct": {
          target: "https://api.lyrics.ovh",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/lyrics-direct/, "/v1"),
        },
        // Fallback lyrics API (lyricsfreak)
        "/lyrics-fallback": {
          target: "https://lyrics-freak.com",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path,
        },
      },
    },
  };
});
