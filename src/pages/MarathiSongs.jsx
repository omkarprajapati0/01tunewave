import { Link } from "react-router-dom";
import { usePlayer } from "../context/PlayerContext";
import { useSongs } from "../context/SongContext";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marathiSongs as localMarathiSongs } from "../data/allSongs";
import * as songApi from "../lib/songApi";
import Sidebar from "../components/layout/Sidebar";
import NowPlayingMedia from "../components/player/NowPlayingMedia";
import { searchSpotify } from "../lib/spotify";
import { transformTrack } from "../utils/spotifyHelpers";
import {
  downloadSongWithFallback,
  getDownloadActionMeta,
  getDownloadActionTheme,
} from "../utils/downloadSong";
import { searchAndCreateSong } from "../lib/youtube";

export default function MarathiSongs() {
  const { currentSong, playSong, formatTime } = usePlayer();
  const {
    marathiSongs: apiMarathiSongs,
    fetchMarathiSongs,
    loadingCategories,
    offsets,
    hasMore,
    isSpotifyConfigured,
  } = useSongs();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const contentRef = useRef(null);

  // Local state for managing displayed songs (used when Spotify is not configured)
  const [displayedSongs, setDisplayedSongs] = useState([]);
  const [localHasMore, setLocalHasMore] = useState(true);
  const [localOffset, setLocalOffset] = useState(0);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const activeSearchIdRef = useRef(0);
  const MIN_SPOTIFY_SEARCH_LENGTH = 3;
  const [isDownloading, setIsDownloading] = useState(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const downloadStatusTimeoutRef = useRef(null);
  const previousSongRef = useRef(null);

  const SONGS_PER_PAGE = 20;

  // Shuffle array function for local songs
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Load local songs with pagination
  const loadLocalSongs = useCallback(
    (loadMore = false) => {
      if (isLoadingLocal) return;

      setIsLoadingLocal(true);

      const allShuffled = shuffleArray(localMarathiSongs);
      const currentOffset = loadMore ? localOffset : 0;
      const songsToShow = allShuffled.slice(
        currentOffset,
        currentOffset + SONGS_PER_PAGE,
      );

      if (loadMore) {
        setDisplayedSongs((prev) => [...prev, ...songsToShow]);
      } else {
        setDisplayedSongs(songsToShow);
      }

      setLocalOffset(currentOffset + songsToShow.length);
      setLocalHasMore(
        currentOffset + SONGS_PER_PAGE < localMarathiSongs.length,
      );
      setIsLoadingLocal(false);
    },
    [localOffset, isLoadingLocal],
  );

  // Initial load for local songs
  useEffect(() => {
    const shouldUseLocalFallback =
      !isSpotifyConfigured ||
      (!loadingCategories.marathi && apiMarathiSongs.length === 0);

    if (shouldUseLocalFallback && displayedSongs.length === 0) {
      loadLocalSongs(false);
    }
  }, [
    isSpotifyConfigured,
    displayedSongs.length,
    loadLocalSongs,
    loadingCategories.marathi,
    apiMarathiSongs.length,
  ]);

  // Use API songs if configured, otherwise use local data
  const shouldUseApiSongs = isSpotifyConfigured && apiMarathiSongs.length > 0;
  const songs = shouldUseApiSongs ? apiMarathiSongs : displayedSongs;
  const displaySong =
    currentSong || (songs.length > 0 ? songs[0] : localMarathiSongs[0]);
  const downloadAction = getDownloadActionMeta(displaySong);
  const downloadButtonTheme = getDownloadActionTheme(
    downloadAction,
    isDownloading,
  );

  // Load more songs when scrolling - handles both API and local
  const loadMore = useCallback(() => {
    if (shouldUseApiSongs) {
      // Use API loading
      if (!loadingCategories.marathi && hasMore.marathi) {
        fetchMarathiSongs(20, offsets.marathi, true);
      }
    } else {
      // Use local loading
      if (!isLoadingLocal && localHasMore) {
        loadLocalSongs(true);
      }
    }
  }, [
    fetchMarathiSongs,
    loadingCategories.marathi,
    hasMore.marathi,
    offsets.marathi,
    shouldUseApiSongs,
    isLoadingLocal,
    localHasMore,
    loadLocalSongs,
  ]);

  // Set up infinite scroll
  useInfiniteScroll(loadMore, {
    enabled: shouldUseApiSongs
      ? hasMore.marathi && !loadingCategories.marathi
      : localHasMore && !isLoadingLocal,
    isLoading: shouldUseApiSongs ? loadingCategories.marathi : isLoadingLocal,
    containerRef: contentRef,
    threshold: 50,
  });

  // Initial load for API songs
  useEffect(() => {
    if (isSpotifyConfigured && apiMarathiSongs.length === 0) {
      fetchMarathiSongs(20, 0, false);
    }
  }, [isSpotifyConfigured, apiMarathiSongs.length, fetchMarathiSongs]);

  // Handle refresh - fetches new songs with random query
  const handleRefresh = () => {
    // Clear the song cache first
    songApi.clearSongCache();

    if (isSpotifyConfigured) {
      // For Spotify: fetch with random query by clearing current songs and re-fetching
      fetchMarathiSongs(20, 0, false).then(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
        }
      });
    } else {
      // For local songs: shuffle and reload
      setDisplayedSongs([]);
      setLocalOffset(0);
      setLocalHasMore(true);
      loadLocalSongs(false);
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }
  };

  // Search functionality
  const performSearch = useCallback(
    async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      const lowerQuery = query.toLowerCase();

      // First, search local songs
      const localResults = localMarathiSongs.filter(
        (song) =>
          song.title.toLowerCase().includes(lowerQuery) ||
          song.artist.toLowerCase().includes(lowerQuery),
      );
      setSearchResults(localResults);

      // If Spotify is configured, search Spotify for more results
      if (
        isSpotifyConfigured &&
        query.trim().length >= MIN_SPOTIFY_SEARCH_LENGTH
      ) {
        try {
          const spotifyResults = await searchSpotify(query, "track", 10);
          const apiSongs = (spotifyResults.tracks?.items || [])
            .map(transformTrack)
            .filter(Boolean)
            .map((song) => ({
              ...song,
              source: "spotify",
              needsYouTubeFallback: !song.src || song.src === "",
            }));

          // Merge with existing results, avoiding duplicates
          setSearchResults((prev) => {
            const existingIds = new Set(
              prev.map((s) => `${s.title}-${s.artist}`),
            );
            const newResults = apiSongs.filter(
              (s) => !existingIds.has(`${s.title}-${s.artist}`),
            );
            return [...prev, ...newResults];
          });
        } catch (error) {
          console.error("Error searching Spotify:", error);
        }
      }
    },
    [isSpotifyConfigured],
  );

  // Handle search input with debounce
  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      const shouldSearchSpotify =
        isSpotifyConfigured && query.trim().length >= MIN_SPOTIFY_SEARCH_LENGTH;
      setIsSearching(shouldSearchSpotify);
      const searchId = ++activeSearchIdRef.current;
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          await performSearch(query);
        } finally {
          if (searchId === activeSearchIdRef.current) {
            setIsSearching(false);
          }
        }
      }, 450);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (downloadStatusTimeoutRef.current) {
        clearTimeout(downloadStatusTimeoutRef.current);
      }
    };
  }, []);

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const showDownloadStatus = (message) => {
    if (downloadStatusTimeoutRef.current) {
      clearTimeout(downloadStatusTimeoutRef.current);
    }
    setDownloadStatus(message);
    downloadStatusTimeoutRef.current = setTimeout(() => {
      setDownloadStatus("");
    }, 3000);
  };

  const handleDownloadCurrentSong = async () => {
    const song = currentSong || displaySong;
    const shouldWatchVideo = downloadAction.label.includes("Watch Video");

    if (!song) {
      showDownloadStatus(
        shouldWatchVideo
          ? "No song selected to watch."
          : "No song selected to download.",
      );
      return;
    }

    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadStatus("");

    try {
      if (shouldWatchVideo) {
        console.log("MarathiSongs: Watch video triggered for", song.title);
        const youtubeSong = await searchAndCreateSong(song.title, song.artist);

        if (!youtubeSong) {
          showDownloadStatus("No video found for this song.");
          return;
        }

        previousSongRef.current = song;
        playSong([youtubeSong], 0);
        setIsVideoActive(true);
        showDownloadStatus("Playing video...");
        return;
      }

      console.log("MarathiSongs: Download triggered for", song.title);
      const result = await downloadSongWithFallback(song);
      showDownloadStatus(result.message);
    } catch (error) {
      console.error(
        shouldWatchVideo
          ? "MarathiSongs: Watch video error:"
          : "MarathiSongs: Download error:",
        error,
      );
      showDownloadStatus(
        error instanceof Error
          ? error.message
          : shouldWatchVideo
            ? "Could not play this video."
            : "Could not download this song.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCloseVideo = () => {
    if (previousSongRef.current) {
      playSong([previousSongRef.current], 0);
      previousSongRef.current = null;
    }
    setIsVideoActive(false);
  };

  const videoActionLabel = isVideoActive ? "Close Video" : "Watch Video";
  const videoActionIcon = isVideoActive ? "fa-xmark" : "fa-circle-play";

  // Determine which songs to show
  const songsToShow = showSearch ? searchResults : songs;

  const sortedSongsToShow = useMemo(() => {
    const list = [...songsToShow];

    switch (sortBy) {
      case "title":
        return list.sort((a, b) =>
          (a.title || "").localeCompare(b.title || "", undefined, {
            sensitivity: "base",
          }),
        );
      case "artist":
        return list.sort((a, b) =>
          (a.artist || "").localeCompare(b.artist || "", undefined, {
            sensitivity: "base",
          }),
        );
      case "duration":
        return list.sort((a, b) => (a.duration || 0) - (b.duration || 0));
      case "default":
      default:
        return list;
    }
  }, [songsToShow, sortBy]);

  const handlePlayAll = () => {
    if (sortedSongsToShow.length === 0) return;
    playSong(sortedSongsToShow, 0);
  };

  const handleShuffle = () => {
    if (sortedSongsToShow.length === 0) return;
    const randomIndex = Math.floor(Math.random() * sortedSongsToShow.length);
    playSong(sortedSongsToShow, randomIndex);
  };

  const handleClearViewControls = () => {
    setSortBy("default");
    if (showSearch) {
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const songGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "12px",
    maxHeight: "calc(100vh - 280px)",
    overflowY: "auto",
    overflowX: "hidden",
    paddingBottom: "20px",
  };

  const songRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "background 0.15s",
    minWidth: 0,
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="main-content" ref={contentRef}>
        <header className="top-nav">
          <div className="breadcrumb">
            <Link to="/homepage" style={{ color: "#333" }}>
              <i className="fa-solid fa-home"></i>
            </Link>{" "}
            / Marathi Songs
          </div>
          <nav>
            {/* Search Button */}
            <button
              className={`nav-link search-btn ${showSearch ? "active" : ""}`}
              onClick={toggleSearch}
              title="Search songs"
              style={{
                background: showSearch
                  ? "rgba(203, 51, 145, 0.2)"
                  : "transparent",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                cursor: "pointer",
              }}
            >
              <i
                className={`fa-solid ${showSearch ? "fa-xmark" : "fa-magnifying-glass"}`}
              ></i>
            </button>

            {/* Refresh Button */}
            <button
              className="nav-link search-btn"
              onClick={handleRefresh}
              disabled={loadingCategories.marathi || isLoadingLocal}
              title="Refresh songs"
              style={{
                background:
                  loadingCategories.marathi || isLoadingLocal
                    ? "rgba(0,0,0,0.1)"
                    : "transparent",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                cursor:
                  loadingCategories.marathi || isLoadingLocal
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              <i
                className={`fa-solid ${loadingCategories.marathi || isLoadingLocal ? "fa-spinner fa-spin" : "fa-refresh"}`}
              ></i>
            </button>
            <Link
              to="/notifications"
              className="nav-link search-btn notifi-acc-btn"
            >
              <i className="fa-solid fa-bell"></i>
            </Link>
            <Link to="/account" className="nav-link search-btn notifi-acc-btn">
              <i className="fa-solid fa-user"></i>
            </Link>
            <button
              className="nav-link mobile-menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <i className="fa-solid fa-bars"></i>
            </button>
          </nav>
        </header>

        {/* Search Input Field */}
        {showSearch && (
          <div className="search-container mb-6" style={{ padding: "0 20px" }}>
            <div className="relative">
              <input
                type="text"
                placeholder="Search Marathi songs..."
                value={searchQuery}
                onChange={handleSearchInput}
                className="w-full px-4 py-3 pl-12 pr-12 bg-neutral-700 border border-gray-700 rounded-lg 
                           text-white placeholder-gray-400 focus:outline-none focus:border-gray-500
                           transition-colors"
                autoFocus
              />
              <svg
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 
                             text-gray-400 hover:text-white hover:bg-gray-700 rounded-full
                             transition-colors"
                  title="Clear search"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
            {/* Search loading indicator */}
            {isSearching && (
              <div className="text-center py-2 text-gray-400 text-sm">
                <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                Searching...
              </div>
            )}
          </div>
        )}

        {/* Song List */}
        <div className="panel" style={{ marginTop: "10px" }}>
          <div className="section-header">
            <h3 style={{ color: "#222", fontSize: "22px" }}>
              {showSearch ? "Search Results" : "Marathi Songs :~"}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                style={{
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  padding: "6px 8px",
                  fontSize: "12px",
                  color: "#222",
                  background: "#fff",
                }}
              >
                <option value="default">Default</option>
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="duration">Duration</option>
              </select>
              <button
                type="button"
                onClick={handlePlayAll}
                disabled={sortedSongsToShow.length === 0}
                style={{
                  padding: "6px 10px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  border: "none",
                  background: sortedSongsToShow.length
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : "#d1d5db",
                  color: "#fff",
                  cursor: sortedSongsToShow.length ? "pointer" : "not-allowed",
                }}
              >
                Play All
              </button>
              <button
                type="button"
                onClick={handleShuffle}
                disabled={sortedSongsToShow.length === 0}
                style={{
                  padding: "6px 10px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  border: "none",
                  background: sortedSongsToShow.length
                    ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                    : "#d1d5db",
                  color: "#fff",
                  cursor: sortedSongsToShow.length ? "pointer" : "not-allowed",
                }}
              >
                Shuffle
              </button>
              <button
                type="button"
                onClick={handleClearViewControls}
                style={{
                  padding: "6px 10px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#222",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
              <span style={{ color: "#666", fontSize: "14px" }}>
                {sortedSongsToShow.length}{" "}
                {sortedSongsToShow.length === 1 ? "song" : "songs"}
              </span>
            </div>
          </div>

          <div style={songGridStyle}>
            {(loadingCategories.marathi || isLoadingLocal) &&
            sortedSongsToShow.length === 0 ? (
              <div
                style={{ color: "#888", padding: "20px", gridColumn: "1 / -1" }}
              >
                <i className="fa-solid fa-spinner fa-spin"></i> Loading songs...
              </div>
            ) : sortedSongsToShow.length > 0 ? (
              sortedSongsToShow.map((song, i) => (
                <div
                  key={`${song.title}-${song.artist}-${i}`}
                  className={`queue-item ${
                    currentSong?.title === song.title &&
                    currentSong?.artist === song.artist
                      ? "active"
                      : ""
                  }`}
                  onClick={() => playSong(sortedSongsToShow, i)}
                  style={{
                    ...songRowStyle,
                    background:
                      currentSong?.title === song.title &&
                      currentSong?.artist === song.artist
                        ? "linear-gradient(90deg, rgba(203, 51, 145, 0.15) 0%, rgba(45, 48, 235, 0.1) 100%)"
                        : "transparent",
                  }}
                >
                  <img
                    src={song.cover}
                    alt={song.title}
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "8px",
                      objectFit: "cover",
                    }}
                  />
                  <div
                    className="qi-info"
                    style={{ flex: 1, minWidth: 0, overflow: "hidden" }}
                  >
                    <div
                      className="title"
                      style={{
                        fontWeight: "600",
                        fontSize: "14px",
                        color: "#222",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    >
                      {song.title}
                    </div>
                    <div
                      className="artist"
                      style={{ fontSize: "12px", color: "#666" }}
                    >
                      {song.artist}
                    </div>
                  </div>
                  <div
                    className="qi-duration"
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      minWidth: "52px",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {song.duration ? formatTime(song.duration) : song.duration}
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{ color: "#888", padding: "20px", gridColumn: "1 / -1" }}
              >
                {isSpotifyConfigured
                  ? "Spotify recommendations are unavailable. Showing local songs."
                  : "Showing local songs. Configure Spotify for more recommendations."}
              </div>
            )}
          </div>
          {(loadingCategories.marathi || isLoadingLocal) &&
            sortedSongsToShow.length > 0 && (
              <div
                style={{ textAlign: "center", padding: "20px", color: "#888" }}
              >
                <i className="fa-solid fa-spinner fa-spin"></i> Loading more
                songs...
              </div>
            )}
          {!showSearch &&
            !localHasMore &&
            sortedSongsToShow.length > 0 &&
            !isSpotifyConfigured && (
              <div
                style={{ textAlign: "center", padding: "20px", color: "#888" }}
              >
                No more songs to load
              </div>
            )}
          {!showSearch &&
            !hasMore.marathi &&
            sortedSongsToShow.length > 0 &&
            isSpotifyConfigured && (
              <div
                style={{ textAlign: "center", padding: "20px", color: "#888" }}
              >
                No more songs to load
              </div>
            )}
        </div>
      </main>

      {/* Now Playing Sidebar */}
      <aside className="now-playing">
        <h3>Now Playing</h3>
        <NowPlayingMedia
          song={displaySong}
          fallbackImage="/Logo-icon.png"
          showVideo={isVideoActive}
          onCloseVideo={handleCloseVideo}
        />
        <div className="now-playing-info">
          <div className="track-title">{displaySong?.title}</div>
          <div className="track-artist">{displaySong?.artist}</div>
        </div>

        {/* Download Button */}
        <div style={{ marginTop: "20px" }}>
          <button
            type="button"
            onClick={
              isVideoActive ? handleCloseVideo : handleDownloadCurrentSong
            }
            disabled={isDownloading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 20px",
              background: downloadButtonTheme.background,
              color: "white",
              borderRadius: "25px",
              border: "none",
              fontWeight: "600",
              fontSize: "14px",
              transition: "opacity 0.2s, box-shadow 0.2s",
              boxShadow: downloadButtonTheme.shadow,
              cursor: isDownloading ? "not-allowed" : "pointer",
              opacity: isDownloading ? 0.8 : 1,
            }}
          >
            <i
              className={`fa-solid ${
                isDownloading
                  ? "fa-spinner fa-spin"
                  : isVideoActive
                    ? videoActionIcon
                    : downloadAction.icon
              }`}
            ></i>
            {isDownloading
              ? isVideoActive || downloadAction.label.includes("Watch Video")
                ? "Loading..."
                : downloadAction.isDirectDownload
                  ? "Downloading..."
                  : "Opening..."
              : isVideoActive
                ? videoActionLabel
                : downloadAction.label.includes("Watch Video")
                  ? "Watch Video"
                  : downloadAction.label}
          </button>
          {downloadStatus && (
            <p
              style={{
                marginTop: "8px",
                color: downloadButtonTheme.statusColor,
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              {downloadStatus}
            </p>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <div className={`mobile-sidebar ${mobileMenuOpen ? "active" : ""}`}>
        <button
          className="mobile-sidebar-close"
          onClick={() => setMobileMenuOpen(false)}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
        <nav>
          <ul>
            <li className="mobile-menu-group-title">Discover</li>
            <li>
              <Link to="/homepage" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-house"></i>
                <span>Home</span>
              </Link>
            </li>

            <li className="mobile-menu-group-title">Song Categories</li>
            <li>
              <Link to="/english" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-music"></i>
                <span>English Songs</span>
              </Link>
            </li>
            <li>
              <Link to="/hindi" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-radio"></i>
                <span>Bollywood Songs</span>
              </Link>
            </li>
            <li>
              <Link to="/marathi" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-compact-disc"></i>
                <span>Marathi Songs</span>
              </Link>
            </li>

            <li className="mobile-menu-group-title">Support</li>
            <li>
              <Link to="/about" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-circle-info"></i>
                <span>About</span>
              </Link>
            </li>
            <li>
              <Link to="/help" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-question"></i>
                <span>Help</span>
              </Link>
            </li>
            <li>
              <Link to="/account" onClick={() => setMobileMenuOpen(false)}>
                <i className="fa-solid fa-users"></i>
                <span>Account</span>
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
