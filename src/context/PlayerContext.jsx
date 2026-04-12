import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { isYouTubeSource } from "../lib/youtube";
import { searchAndCreateSong } from "../lib/youtube";

const PlayerContext = createContext();
const IS_DEV = import.meta.env.DEV;

// Silent 1-second MP3 to use as placeholder for YouTube sources
// Prevents "no supported source" errors when audio.src is empty
const SILENT_AUDIO =
  "data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

export const PlayerProvider = ({ children }) => {
  const audioRef = useRef(new Audio());
  const fallbackInProgressRef = useRef(false);
  const fallbackAttemptedRef = useRef(new Set());

  // YouTube player reference - will be set by YouTubePlayer component
  const youtubePlayerRef = useRef(null);

  const [songs, setSongs] = useState([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [error, setError] = useState(null);
  const [isYouTubePlaying, setIsYouTubePlaying] = useState(false);
  const [youtubeMountElement, setYoutubeMountElement] = useState(null);

  const currentSong = songs[index] || null;

  /**
   * Check if a song is from YouTube - comprehensive check
   * Must be defined before isCurrentSongFromYouTube
   */
  const isYouTubeSong = useCallback((song) => {
    if (!song) return false;
    return (
      song?.source === "youtube" ||
      song?.srcType === "youtube" ||
      isYouTubeSource(song?.src) ||
      // Also check if src is a YouTube URL that wasn't caught above
      (song?.src &&
        typeof song.src === "string" &&
        song.src.includes("youtube.com"))
    );
  }, []);

  // Check if current song is from YouTube using comprehensive check
  const isCurrentSongFromYouTube = isYouTubeSong(currentSong);

  /**
   * Check if a source is a valid audio URL (not a YouTube video ID)
   * YouTube video IDs are 11-character strings that should not be set as audio.src
   */
  const isValidAudioUrl = useCallback((src) => {
    if (!src) return false;
    // If it's a YouTube video ID (11 chars, alphanumeric), it's NOT a valid audio URL
    if (isYouTubeSource(src)) return false;
    // Must be a valid URL starting with http/https
    return (
      typeof src === "string" &&
      (src.startsWith("http://") || src.startsWith("https://"))
    );
  }, []);

  const songKey = useCallback(
    (song) => `${song?.title || ""}::${song?.artist || ""}`,
    [],
  );

  const tryYouTubeFallback = useCallback(
    async (song, songIndex = null) => {
      if (!song || isYouTubeSong(song)) {
        return false;
      }

      if (fallbackInProgressRef.current) {
        return false;
      }

      const key = songKey(song);
      if (fallbackAttemptedRef.current.has(key)) {
        return false;
      }

      fallbackAttemptedRef.current.add(key);
      fallbackInProgressRef.current = true;
      setError("Track preview unavailable. Trying YouTube fallback...");

      try {
        const youtubeSong = await searchAndCreateSong(song.title, song.artist);

        if (!youtubeSong) {
          setError("Could not play this track right now.");
          setPlaying(false);
          return false;
        }

        const fallbackSong = {
          ...song,
          src: youtubeSong.src,
          srcType: "youtube",
          source: "youtube",
          cover: youtubeSong.cover || song.cover,
          needsYouTubeFallback: false,
          youtubeTitle: youtubeSong.youtubeTitle,
        };

        setSongs((prevSongs) => {
          const targetIndex =
            typeof songIndex === "number"
              ? songIndex
              : prevSongs.findIndex(
                  (candidate) =>
                    candidate?.title === song?.title &&
                    candidate?.artist === song?.artist,
                );

          if (targetIndex < 0) {
            return prevSongs;
          }

          const updated = [...prevSongs];
          updated[targetIndex] = fallbackSong;
          return updated;
        });

        if (typeof songIndex === "number") {
          setIndex(songIndex);
        }

        setError(null);
        setPlaying(true);
        setIsYouTubePlaying(true);
        return true;
      } catch (fallbackError) {
        if (IS_DEV) {
          console.error("YouTube fallback failed:", fallbackError);
        }
        setError("Could not play this track right now.");
        setPlaying(false);
        return false;
      } finally {
        fallbackInProgressRef.current = false;
      }
    },
    [isYouTubeSong, songKey],
  );

  // Helper function to play audio with error handling
  const playAudio = useCallback(
    async (songToPlay, songIndex = null) => {
      // Determine if this is a YouTube source (use comprehensive check)
      const song = songToPlay;
      if (!song) return;
      console.log(
        "playAudio called with song:",
        song?.title,
        "src:",
        song?.src,
        "source:",
        song?.source,
        "srcType:",
        song?.srcType,
      );
      const isYouTube = isYouTubeSong(song);
      console.log("isYouTube:", isYouTube);

      // If YouTube source, set playing state and let YouTubePlayer handle playback
      // DO NOT interact with audio element at all for YouTube sources
      if (isYouTube) {
        console.log("Setting playing=true for YouTube");
        setPlaying(true);
        setIsYouTubePlaying(true);
        return;
      }

      // For non-YouTube sources, check if we have a valid audio URL
      if (!isValidAudioUrl(song?.src)) {
        console.log(
          "No valid audio source, skipping audio playback. song?.src:",
          song?.src,
        );
        const recovered = await tryYouTubeFallback(song, songIndex);
        if (!recovered) {
          setPlaying(false);
        }
        return;
      }

      // Ensure audio element has the correct src
      if (audioRef.current.src !== song.src) {
        audioRef.current.src = song.src;
      }

      // Only try to play if we have a valid audio element with proper source
      if (
        !audioRef.current.src ||
        audioRef.current.src === "" ||
        audioRef.current.src === SILENT_AUDIO
      ) {
        console.log("Audio element has no valid source, skipping playback");
        setPlaying(false);
        return;
      }

      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch (err) {
        const errorMessage = err?.message || "Playback failed";
        const isUnsupportedSourceError = /no supported source/i.test(
          errorMessage,
        );

        if (isUnsupportedSourceError) {
          if (IS_DEV) {
            console.warn("Audio preview unavailable for this track");
          }
          const recovered = await tryYouTubeFallback(song, songIndex);
          if (!recovered) {
            setError("Audio preview unavailable for this track.");
          }
        } else {
          if (IS_DEV) {
            console.error("Error playing audio:", errorMessage);
          }
          setError(errorMessage);
        }
        setPlaying(false);
      }
    },
    [isYouTubeSong, isValidAudioUrl, tryYouTubeFallback],
  );

  // Format time helper
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Play a song from a list
  const playSong = useCallback(
    (list, i) => {
      const song = list[i];
      setSongs(list);
      setIndex(i);

      // Check if this is a YouTube source (use comprehensive check)
      const isYouTube = isYouTubeSong(song);

      // Reset audio element state before setting new source
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      // Only set audio src for valid audio URLs (not YouTube video IDs)
      if (isValidAudioUrl(song?.src)) {
        audioRef.current.src = song.src;
      } else if (!isYouTube) {
        // Only set silent audio for non-YouTube sources without valid URLs
        audioRef.current.src = SILENT_AUDIO;
      } else {
        // For YouTube sources, completely reset audio element
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }

      setError(null);
      playAudio(song, i);
    },
    [playAudio, isValidAudioUrl, isYouTubeSong],
  );

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!currentSong) return;

    // Check if this is a YouTube source (use comprehensive check)
    const isYouTube = isYouTubeSong(currentSong);

    if (playing) {
      // Pause both audio and YouTube
      audioRef.current.pause();
      setPlaying(false);
      setIsYouTubePlaying(false);
      // Also pause YouTube player if available
      if (youtubePlayerRef.current && youtubePlayerRef.current.pauseVideo) {
        youtubePlayerRef.current.pauseVideo();
      }
    } else {
      // For YouTube sources, just set playing state (YouTubePlayer handles actual playback)
      if (isYouTube) {
        setPlaying(true);
        setIsYouTubePlaying(true);
        // Also play YouTube player if available
        if (youtubePlayerRef.current && youtubePlayerRef.current.playVideo) {
          youtubePlayerRef.current.playVideo();
        }
        return;
      }

      // For regular audio sources - ensure we have a valid source before playing
      if (isValidAudioUrl(currentSong?.src)) {
        // Make sure audio src is set correctly
        if (audioRef.current.src !== currentSong.src) {
          audioRef.current.src = currentSong.src;
        }
        playAudio(currentSong, index);
      } else {
        console.log("No valid audio source for playback");
      }
    }
  }, [
    currentSong,
    playing,
    playAudio,
    isValidAudioUrl,
    isYouTubeSong,
    index,
  ]);

  // Next track - handle YouTube fallback for songs without valid src
  const nextTrack = useCallback(async () => {
    if (songs.length === 0) {
      console.log("nextTrack: songs array is empty");
      return;
    }
    let newIndex;
    if (isShuffle) {
      newIndex = Math.floor(Math.random() * songs.length);
    } else {
      newIndex = (index + 1) % songs.length;
    }
    console.log(
      "nextTrack: current index:",
      index,
      "new index:",
      newIndex,
      "total songs:",
      songs.length,
    );
    let song = songs[newIndex];
    console.log(
      "nextTrack: next song:",
      song?.title,
      "src:",
      song?.src,
      "source:",
      song?.source,
    );

    // If song needs YouTube fallback and doesn't have a valid src, fetch YouTube
    if ((!song.src || song.src === "") && song.needsYouTubeFallback) {
      console.log("nextTrack: fetching YouTube fallback for:", song.title);
      try {
        const youtubeSong = await searchAndCreateSong(song.title, song.artist);
        if (youtubeSong) {
          song = {
            ...song,
            src: youtubeSong.src,
            srcType: "youtube",
            source: "youtube",
            cover: youtubeSong.cover || song.cover,
            needsYouTubeFallback: false,
          };
          // Update the song in the songs array
          const updatedSongs = [...songs];
          updatedSongs[newIndex] = song;
          setSongs(updatedSongs);
          console.log("nextTrack: YouTube fallback fetched:", song.src);
        }
      } catch (error) {
        if (IS_DEV) {
          console.error("nextTrack: Error fetching YouTube fallback:", error);
        }
      }
    }

    setIndex(newIndex);

    // Check if this is a YouTube source (use comprehensive check)
    const isYouTube = isYouTubeSong(song);

    // Reset audio element state
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    // Only set audio src for valid audio URLs (not YouTube video IDs)
    if (isValidAudioUrl(song?.src)) {
      audioRef.current.src = song.src;
    } else if (!isYouTube) {
      // Only set silent audio for non-YouTube sources without valid URLs
      audioRef.current.src = SILENT_AUDIO;
    } else {
      // For YouTube sources, completely reset audio element
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }

    setError(null);
    playAudio(song, newIndex);
  }, [songs, index, isShuffle, playAudio, isValidAudioUrl, isYouTubeSong]);

  // Previous track
  const prevTrack = useCallback(() => {
    if (songs.length === 0) return;
    let newIndex;
    if (isShuffle) {
      newIndex = Math.floor(Math.random() * songs.length);
    } else {
      newIndex = (index - 1 + songs.length) % songs.length;
    }
    const song = songs[newIndex];
    setIndex(newIndex);

    // Check if this is a YouTube source (use comprehensive check)
    const isYouTube = isYouTubeSong(song);

    // Reset audio element state
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    // Only set audio src for valid audio URLs (not YouTube video IDs)
    if (isValidAudioUrl(song?.src)) {
      audioRef.current.src = song.src;
    } else if (!isYouTube) {
      // Only set silent audio for non-YouTube sources without valid URLs
      audioRef.current.src = SILENT_AUDIO;
    } else {
      // For YouTube sources, completely reset audio element
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }

    setError(null);
    playAudio(song, newIndex);
  }, [songs, index, isShuffle, playAudio, isValidAudioUrl, isYouTubeSong]);

  // Seek to position - works for both audio and YouTube
  const seekTo = useCallback(
    (percent) => {
      // Check if current song is from YouTube (use comprehensive check)
      const isYouTube = isYouTubeSong(currentSong);

      if (
        isYouTube &&
        youtubePlayerRef.current &&
        youtubePlayerRef.current.seekTo
      ) {
        // Seek in YouTube player
        const seekTime = (percent / 100) * duration;
        youtubePlayerRef.current.seekTo(seekTime, true);
        setCurrentTime(seekTime);
        setProgress(percent);
      } else if (audioRef.current.duration) {
        // Seek in audio element
        audioRef.current.currentTime =
          (percent / 100) * audioRef.current.duration;
      }
    },
    [currentSong, duration, isYouTubeSong],
  );

  // Set volume
  const changeVolume = useCallback((val) => {
    audioRef.current.volume = val;
    setVolume(val);
    // Also set YouTube volume if available
    if (youtubePlayerRef.current && youtubePlayerRef.current.setVolume) {
      youtubePlayerRef.current.setVolume(val * 100);
    }
  }, []);

  // Toggle shuffle
  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  // Toggle repeat
  const toggleRepeat = useCallback(() => {
    setIsRepeat((prev) => !prev);
  }, []);

  // Set YouTube player reference (called by YouTubePlayer component)
  const setYouTubePlayer = useCallback((player) => {
    youtubePlayerRef.current = player;
  }, []);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      if (isRepeat) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        nextTrack();
      }
    };

    const handleError = (e) => {
      // Prevent "no supported source" errors from showing in console
      // This happens when audio.src is empty or invalid (e.g., YouTube video ID)
      e.preventDefault();
      e.stopPropagation();
      if (currentSong && !isYouTubeSong(currentSong)) {
        void tryYouTubeFallback(currentSong, index);
      }
      // Silently ignore - the UI will show appropriate state
      return false;
    };

    // Suppress global audio errors for YouTube sources
    const originalConsoleError = console.error;
    const suppressedPatterns = [
      "no supported source",
      "Failed to load",
      "because no supported source",
      "MEDIA_ELEMENT_ERROR",
      "Empty src",
    ];

    console.error = (...args) => {
      const message = args[0]?.toString() || "";
      const shouldSuppress = suppressedPatterns.some((pattern) =>
        message.toLowerCase().includes(pattern.toLowerCase()),
      );

      if (shouldSuppress) {
        // Suppress audio-related errors for YouTube sources
        return;
      }
      originalConsoleError.apply(console, args);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      // Restore original console.error
      console.error = originalConsoleError;
    };
  }, [
    isRepeat,
    nextTrack,
    currentSong,
    index,
    isYouTubeSong,
    tryYouTubeFallback,
  ]);

  // Keyboard space to toggle play
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && e.target.tagName !== "INPUT") {
        e.preventDefault();
        togglePlay();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay]);

  return (
    <PlayerContext.Provider
      value={{
        songs,
        index,
        currentSong,
        playing,
        progress,
        currentTime,
        duration,
        volume,
        isShuffle,
        isRepeat,
        error,
        isYouTubePlaying,
        isCurrentSongFromYouTube,
        youtubeMountElement,
        setYoutubeMountElement,
        formatTime,
        playSong,
        togglePlay,
        nextTrack,
        prevTrack,
        seekTo,
        changeVolume,
        toggleShuffle,
        toggleRepeat,
        setProgress,
        setCurrentTime,
        setDuration,
        setYouTubePlayer,
        youtubePlayerRef,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
