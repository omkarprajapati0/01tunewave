const IS_DEV = import.meta.env.DEV;

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const sanitizeFileName = (value) => {
  return (value || "song")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const isYouTubeId = (value) => {
  return typeof value === "string" && YOUTUBE_ID_REGEX.test(value);
};

const extractYouTubeIdFromUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    if (host.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return isYouTubeId(id) ? id : "";
    }

    if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
      const watchId = url.searchParams.get("v") || "";
      if (isYouTubeId(watchId)) return watchId;

      const pathParts = url.pathname.split("/").filter(Boolean);
      const embedId = pathParts[0] === "embed" ? pathParts[1] : "";
      return isYouTubeId(embedId) ? embedId : "";
    }
  } catch {
    return "";
  }

  return "";
};

const getSongYouTubeId = (song) => {
  if (!song) return "";

  const sourceUrl = typeof song?.src === "string" ? song.src.trim() : "";
  if (isYouTubeId(sourceUrl)) return sourceUrl;

  const fromSrcUrl = extractYouTubeIdFromUrl(sourceUrl);
  if (fromSrcUrl) return fromSrcUrl;

  const directVideoId =
    typeof song?.videoId === "string" ? song.videoId.trim() : "";
  if (isYouTubeId(directVideoId)) return directVideoId;

  const youtubeUrl =
    typeof song?.youtubeUrl === "string" ? song.youtubeUrl.trim() : "";
  return extractYouTubeIdFromUrl(youtubeUrl);
};

const buildYouTubeEmbedUrl = (videoId, autoplay = false) => {
  if (!isYouTubeId(videoId)) return "";

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";

  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    enablejsapi: "1",
    mute: "1",
    fs: "0",
    disablekb: "1",
    iv_load_policy: "3",
    cc_load_policy: "0",
  });

  if (origin) {
    params.set("origin", origin);
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
};

const isHttpUrl = (value) =>
  typeof value === "string" &&
  (value.startsWith("http://") || value.startsWith("https://"));

const getFallbackUrl = (song) => {
  const sourceUrl = typeof song?.src === "string" ? song.src : "";

  if (song?.source === "youtube" || song?.srcType === "youtube") {
    return sourceUrl ? `https://www.youtube.com/watch?v=${sourceUrl}` : "";
  }

  if (isYouTubeId(sourceUrl)) {
    return `https://www.youtube.com/watch?v=${sourceUrl}`;
  }

  if (song?.source === "spotify") {
    if (song?.spotifyId) {
      return `https://open.spotify.com/track/${song.spotifyId}`;
    }

    if (song?.albumId) {
      return `https://open.spotify.com/album/${song.albumId}`;
    }
  }

  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${song?.title || ""} ${song?.artist || ""}`,
  )}`;
};

export const getDownloadActionMeta = (song) => {
  const sourceUrl = typeof song?.src === "string" ? song.src : "";

  if (!song) {
    return {
      isDirectDownload: false,
      label: "Open Source",
      icon: "fa-arrow-up-right-from-square",
    };
  }

  if (song?.source === "spotify" || song?.srcType === "spotify") {
    return {
      isDirectDownload: false,
      label: "Download Song / Watch Video",
      icon: "fa-download",
    };
  }

  if (song?.source === "youtube" || song?.srcType === "youtube") {
    return {
      isDirectDownload: false,
      label: "Open YouTube",
      icon: "fa-circle-play",
    };
  }

  if (isYouTubeId(sourceUrl)) {
    return {
      isDirectDownload: false,
      label: "Open YouTube",
      icon: "fa-circle-play",
    };
  }

  if (isHttpUrl(sourceUrl)) {
    return {
      isDirectDownload: true,
      label: "Download Song",
      icon: "fa-download",
    };
  }

  return {
    isDirectDownload: false,
    label: "Open Source",
    icon: "fa-arrow-up-right-from-square",
  };
};

export const getDownloadActionTheme = (actionMeta, isBusy = false) => {
  const fallbackTheme = {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    shadow: isBusy
      ? "0 2px 10px rgba(102, 126, 234, 0.3)"
      : "0 4px 15px rgba(102, 126, 234, 0.4)",
    statusColor: "#bfc7ff",
  };

  if (!actionMeta) return fallbackTheme;

  if (actionMeta.label === "Download Song / Watch Video") {
    return {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      shadow: isBusy
        ? "0 2px 10px rgba(102, 126, 234, 0.3)"
        : "0 4px 15px rgba(102, 126, 234, 0.4)",
      statusColor: "#bfc7ff",
    };
  }

  if (actionMeta.label === "Open YouTube") {
    return {
      background: "linear-gradient(135deg, #ff3b30 0%, #c31432 100%)",
      shadow: isBusy
        ? "0 2px 10px rgba(255, 59, 48, 0.3)"
        : "0 4px 15px rgba(255, 59, 48, 0.45)",
      statusColor: "#ffb3af",
    };
  }

  if (actionMeta.isDirectDownload) {
    return {
      background: "linear-gradient(135deg, #2d30eb 0%, #cb3391 100%)",
      shadow: isBusy
        ? "0 2px 10px rgba(45, 48, 235, 0.3)"
        : "0 4px 15px rgba(203, 51, 145, 0.45)",
      statusColor: "#d9c3ff",
    };
  }

  return fallbackTheme;
};

export const getSongVideoEmbedUrl = async (song) => {
  const resolvedYouTubeId = getSongYouTubeId(song);
  if (resolvedYouTubeId) {
    return buildYouTubeEmbedUrl(resolvedYouTubeId, true);
  }

  if (!song?.title && !song?.artist) {
    return "";
  }

  try {
    const { searchAndCreateSong } = await import("../lib/youtube");
    const youtubeSong = await searchAndCreateSong(
      song?.title || "",
      song?.artist || "",
    );
    const searchedVideoId = getSongYouTubeId(youtubeSong);
    return searchedVideoId ? buildYouTubeEmbedUrl(searchedVideoId, true) : "";
  } catch (error) {
    if (IS_DEV) {
      console.error("getSongVideoEmbedUrl: Failed to resolve video", error);
    }
    return "";
  }
};

export const downloadSongWithFallback = async (song) => {
  if (!song) {
    console.error("downloadSong: No song provided");
    const IS_DEV = import.meta.env.DEV;
    return { ok: false, message: "No song selected." };
  }

  if (IS_DEV) {
    console.error("downloadSong: No song provided");
  }

  // For Spotify songs, always use fallback (no direct download available)
  if (song.source === "spotify" || song.srcType === "spotify") {
    console.log("downloadSong: Spotify source detected, using fallback");
    const fallbackUrl = getFallbackUrl(song);
    if (fallbackUrl) {
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      return {
        ok: false,
        message: "Spotify preview available. Opened in new tab.",
      };
    }
    return { ok: false, message: "Could not open Spotify preview." };
  }

  const sourceUrl = typeof song.src === "string" ? song.src : "";
  const hasDirectAudioUrl = isHttpUrl(sourceUrl);

  try {
    // Validate URL
    if (!sourceUrl) {
      throw new Error("Song has no source URL.");
    }

    if (!hasDirectAudioUrl) {
      throw new Error("Source URL is not a valid HTTP/HTTPS URL.");
    }

    if (isYouTubeId(sourceUrl)) {
      throw new Error("Direct download is unavailable for YouTube sources.");
    }

    console.log("downloadSong: Attempting to fetch from", sourceUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        Accept: "audio/mpeg, audio/*;q=0.9",
      },
      mode: "cors",
      credentials: "omit",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (IS_DEV) {
        console.error(
          "downloadSong: Fetch failed with status",
          response.status,
          response.statusText,
        );
      }

      throw new Error(
        `Failed to fetch song: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    console.log("downloadSong: Content type:", contentType);

    const blob = await response.blob();

    if (!blob || blob.size === 0) {
      throw new Error("Downloaded file is empty.");
    }

    console.log("downloadSong: Blob created, size:", blob.size);

    const blobUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    const fileName = sanitizeFileName(`${song.title} - ${song.artist}`);

    downloadLink.href = blobUrl;
    downloadLink.download = `${fileName}.mp3`;
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);

    console.log("downloadSong: Triggering download for", fileName);

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      downloadLink.click();
      // Clean up after a short delay
      setTimeout(() => {
        downloadLink.remove();
        URL.revokeObjectURL(blobUrl);
      }, 100);
    });

    return { ok: true, message: "Download started" };
  } catch (error) {
    if (IS_DEV) {
      console.error("downloadSong: Error during download:", error);
    }

    // Try fallback for unsupported sources
    const fallbackUrl = getFallbackUrl(song);
    if (fallbackUrl) {
      console.log("downloadSong: Opening fallback URL:", fallbackUrl);
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      return {
        ok: false,
        message: "Direct download unavailable. Opening in new tab...",
      };
    }

    return {
      ok: false,
      message: error.message || "Could not download this song.",
    };
  }
};
