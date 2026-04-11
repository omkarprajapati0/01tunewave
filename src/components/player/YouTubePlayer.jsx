import { useEffect, useRef, useState } from "react";
import { usePlayer } from "../../context/PlayerContext";
import { isYouTubeSource } from "../../lib/youtube";

// Hook to load YouTube IFrame API
const useYouTubeAPI = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsLoaded(true);
      return;
    }

    const callbackName = "onYouTubeIframeAPIReady";
    const previousHandler = window[callbackName];
    const readyHandler = () => {
      if (typeof previousHandler === "function") {
        previousHandler();
      }
      console.log("YouTube IFrame API ready");
      setIsLoaded(true);
    };

    window[callbackName] = readyHandler;

    // Load the YouTube IFrame API only once
    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    if (!existingScript) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag?.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }

    return () => {
      if (window[callbackName] === readyHandler) {
        window[callbackName] =
          typeof previousHandler === "function" ? previousHandler : undefined;
      }
    };
  }, []);

  return isLoaded;
};

// YouTube Player Component
export default function YouTubePlayer({
  videoId,
  isPlaying = false,
  autoPlay = false,
  onReady,
  onStateChange,
  onEnded,
  containerElement = null,
}) {
  const playerRef = useRef(null);
  const containerIdRef = useRef(null);
  const mountedContainerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const apiLoaded = useYouTubeAPI();
  const { setProgress, setCurrentTime, setDuration, setYouTubePlayer } =
    usePlayer();
  const progressIntervalRef = useRef(null);
  const currentVideoIdRef = useRef(null);

  // Generate unique container ID once
  if (!containerIdRef.current) {
    containerIdRef.current = `youtube-player-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Initialize player when API is ready
  useEffect(() => {
    if (!apiLoaded) return;

    // Create or reuse the active container. Prefer the visible mount point when provided.
    let container =
      containerElement || document.getElementById(containerIdRef.current);
    if (!container) {
      container = document.createElement("div");
      container.id = containerIdRef.current;
      container.style.display = "none";
      document.body.appendChild(container);
    }

    const containerChanged = mountedContainerRef.current !== container;
    if (playerRef.current && containerChanged) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        console.warn("Error destroying player before remount:", e);
      }
      playerRef.current = null;
      setIsPlayerReady(false);
      mountedContainerRef.current = null;
    }

    // Only create player if it doesn't exist
    if (!playerRef.current) {
      console.log("Creating new YouTube player with videoId:", videoId);
      playerRef.current = new window.YT.Player(container, {
        host: "https://www.youtube-nocookie.com",
        videoId: videoId,
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          controls: 1,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          loop: 0,
          playlist: videoId,
        },
        events: {
          onReady: (event) => {
            console.log("YouTube player ready");
            setIsPlayerReady(true);
            mountedContainerRef.current = container;
            // Register player with PlayerContext
            setYouTubePlayer(event.target);
            if (onReady) onReady(event.target);
            // Only auto-start when explicitly allowed
            if (autoPlay && isPlaying) {
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            console.log("YouTube player state changed:", event.data);
            if (onStateChange) onStateChange(event);
            // Handle video ended
            if (event.data === window.YT.PlayerState.ENDED) {
              console.log("Video ended");
              if (onEnded) onEnded();
            }
          },
        },
      });
    }

    return () => {
      // Cleanup player on unmount
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying player:", e);
        }
        playerRef.current = null;
      }
      setIsPlayerReady(false);
      setYouTubePlayer(null);
      mountedContainerRef.current = null;

      // Remove container from DOM
      const containerToRemove = document.getElementById(containerIdRef.current);
      if (containerToRemove && containerToRemove.parentNode) {
        containerToRemove.parentNode.removeChild(containerToRemove);
      }
      currentVideoIdRef.current = null;
    };
  }, [
    apiLoaded,
    setYouTubePlayer,
    onReady,
    onStateChange,
    onEnded,
    videoId,
    isPlaying,
    autoPlay,
    containerElement,
  ]);

  // Handle video ID changes - load new video without recreating player
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady || !videoId) return;

    // Skip if same video
    if (currentVideoIdRef.current === videoId) return;

    console.log("Loading new video:", videoId, "isPlaying:", isPlaying);
    currentVideoIdRef.current = videoId;

    const player = playerRef.current;

    // Defensive check: ensure player and methods exist
    if (!player) {
      console.warn("YouTube player not available");
      return;
    }

    try {
      // Try loadVideoById first (starts playing immediately)
      if (typeof player.loadVideoById === "function") {
        player.loadVideoById({
          videoId: videoId,
          startSeconds: 0,
        });
        // Ensure playback starts if isPlaying is true
        if (isPlaying && typeof player.playVideo === "function") {
          player.playVideo();
        }
      }
      // Fallback to cueVideoById (loads but doesn't auto-play)
      else if (typeof player.cueVideoById === "function") {
        console.log("Using cueVideoById as fallback");
        player.cueVideoById({
          videoId: videoId,
          startSeconds: 0,
        });
        // If should be playing, start playback after cueing
        if (isPlaying && typeof player.playVideo === "function") {
          player.playVideo();
        }
      }
      // Last resort: recreate player
      else {
        console.warn("No video loading method available, recreating player");
        // Trigger player recreation by resetting the ref
        const containerId = containerIdRef.current;
        if (player.destroy) {
          try {
            player.destroy();
          } catch {
            /* ignore */
          }
        }
        playerRef.current = null;
        setIsPlayerReady(false);

        // Small delay to allow cleanup before recreation
        setTimeout(() => {
          const container = document.getElementById(containerId);
          if (container && window.YT && window.YT.Player) {
            playerRef.current = new window.YT.Player(container, {
              host: "https://www.youtube-nocookie.com",
              videoId: videoId,
              playerVars: {
                autoplay: autoPlay ? 1 : 0,
                controls: 1,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3,
                loop: 0,
                playlist: videoId,
              },
              events: {
                onReady: (event) => {
                  setIsPlayerReady(true);
                  setYouTubePlayer(event.target);
                  // Start playing only when autoplay is explicitly enabled
                  if (autoPlay && isPlaying && event.target.playVideo) {
                    event.target.playVideo();
                  }
                },
              },
            });
          }
        }, 100);
      }
    } catch (e) {
      console.error("Error loading video:", e);
    }
  }, [videoId, isPlayerReady, setYouTubePlayer, isPlaying, autoPlay]);

  // Handle play/pause changes
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;

    // Check if player methods are available
    const player = playerRef.current;

    console.log("Play/pause changed, isPlaying:", isPlaying);

    if (isPlaying) {
      try {
        player.playVideo();
      } catch (e) {
        console.error("Error playing video:", e);
      }
      // Start progress tracking
      if (!progressIntervalRef.current) {
        progressIntervalRef.current = setInterval(() => {
          if (playerRef.current && playerRef.current.getCurrentTime) {
            try {
              const currentTime = playerRef.current.getCurrentTime();
              const duration = playerRef.current.getDuration();
              if (duration > 0) {
                const progress = (currentTime / duration) * 100;
                setProgress(progress);
                setCurrentTime(currentTime);
                setDuration(duration);
              }
            } catch {
              // Ignore errors during progress tracking
            }
          }
        }, 1000);
      }
    } else {
      try {
        player.pauseVideo();
      } catch (e) {
        console.error("Error pausing video:", e);
      }
      // Stop progress tracking
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [isPlaying, isPlayerReady, setProgress, setCurrentTime, setDuration]);

  // This component doesn't render anything to React's DOM tree
  // The container is created and managed manually to avoid React conflicts
  return null;
}

// Utility function to check if a source is YouTube
export const isYouTubeVideo = (src, source) => {
  return source === "youtube" || isYouTubeSource(src);
};

// Get video ID from various formats
export const getVideoId = (song) => {
  if (!song) return null;

  // If song has explicit youtube video ID in src
  if (isYouTubeSource(song.src)) {
    return song.src;
  }

  // Check if srcType is youtube (can also have video ID in src)
  if (song.srcType === "youtube") {
    // If src is already a valid YouTube video ID, return it
    if (isYouTubeSource(song.src)) {
      return song.src;
    }
    // If src has a full YouTube URL, extract the video ID
    if (song.src && typeof song.src === "string") {
      const match = song.src.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }

  return null;
};
