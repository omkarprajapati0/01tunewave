import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { usePlaylist } from "../context/PlaylistContext";
import { useAuth } from "../context/AuthContext";
import { useSongs } from "../context/SongContext";
import { usePlayer } from "../context/PlayerContext";
import Sidebar from "../components/layout/Sidebar";
import { searchSpotify } from "../lib/spotify";
import { transformTrack } from "../utils/spotifyHelpers";

// Diverse gradient colors for playlists
const GRADIENTS = [
  "linear-gradient(135deg, #3a3a3a 100%, #bdbdbd 100%)", // Charcoal to light gray
];

// Get gradient based on playlist name (deterministic)
const getGradientForPlaylist = (playlistName) => {
  if (!playlistName) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < playlistName.length; i++) {
    hash = playlistName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
};

export default function Playlists() {
  const { user } = useAuth();
  const {
    playlists,
    createPlaylist,
    deletePlaylist,
    addSongToPlaylist,
    playlistIdMigrationCount,
    showPlaylistMigrationNotice,
    dismissPlaylistMigrationNotice,
  } = usePlaylist();
  const { isSpotifyConfigured, allSongs: localAllSongs } = useSongs();
  const { playSong, formatTime } = usePlayer();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [playlistSortBy, setPlaylistSortBy] = useState("recent");
  const [targetPlaylistId, setTargetPlaylistId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const searchTimeoutRef = useRef(null);
  const actionMessageTimeoutRef = useRef(null);
  const activeSearchIdRef = useRef(0);
  const MIN_SPOTIFY_SEARCH_LENGTH = 3;

  useEffect(() => {
    if (playlists.length === 0) {
      setTargetPlaylistId("");
      return;
    }

    const exists = playlists.some(
      (playlist) => playlist.id === targetPlaylistId,
    );
    if (!exists) {
      setTargetPlaylistId(playlists[0].id);
    }
  }, [playlists, targetPlaylistId]);

  const showActionMessage = (message) => {
    if (actionMessageTimeoutRef.current) {
      clearTimeout(actionMessageTimeoutRef.current);
    }
    setActionMessage(message);
    actionMessageTimeoutRef.current = setTimeout(() => {
      setActionMessage("");
    }, 2500);
  };

  const filteredSortedPlaylists = useMemo(() => {
    const normalizedQuery = playlistQuery.trim().toLowerCase();
    const filtered = playlists.filter((playlist) => {
      if (!normalizedQuery) return true;
      return (playlist.name || "").toLowerCase().includes(normalizedQuery);
    });

    const getCreatedAt = (value) => new Date(value || 0).getTime() || 0;
    switch (playlistSortBy) {
      case "name":
        return [...filtered].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", undefined, {
            sensitivity: "base",
          }),
        );
      case "songs":
        return [...filtered].sort(
          (a, b) => (b.songs?.length || 0) - (a.songs?.length || 0),
        );
      case "recent":
      default:
        return [...filtered].sort(
          (a, b) => getCreatedAt(b.createdAt) - getCreatedAt(a.createdAt),
        );
    }
  }, [playlists, playlistQuery, playlistSortBy]);

  const handleAddSongToSelectedPlaylist = (song) => {
    if (!targetPlaylistId) {
      showActionMessage("Create a playlist first.");
      return;
    }
    addSongToPlaylist(targetPlaylistId, song);
    const targetPlaylist = playlists.find(
      (playlist) => playlist.id === targetPlaylistId,
    );
    showActionMessage(`Added to ${targetPlaylist?.name || "playlist"}`);
  };

  const handleCreatePlaylist = (e) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName);
      setNewPlaylistName("");
      setShowCreateModal(false);
    }
  };

  const handleDelete = (e, playlistId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this playlist?")) {
      deletePlaylist(playlistId);
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

      // First, search local songs from all categories
      const localResults = localAllSongs.filter(
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
    [isSpotifyConfigured, localAllSongs],
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
      if (actionMessageTimeoutRef.current) {
        clearTimeout(actionMessageTimeoutRef.current);
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

  // Play search result
  const handlePlaySearchResult = (song, index) => {
    playSong(searchResults, index);
  };

  if (!user) {
    return (
      <div className="app-container playlists-page">
        <Sidebar />
        <main className="main-content playlists-main">
          <div className="min-h-[70vh] flex items-center justify-center px-4">
            <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 text-center shadow-2xl">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-2xl text-white">
                <i className="fa-solid fa-lock"></i>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Your playlists are hidden
              </h2>
              <p className="text-gray-300 mb-6">
                Log in to see and manage your playlists.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-600 to-indigo-600 px-6 py-3 font-semibold text-white hover:opacity-95 transition"
                >
                  Go to Login
                </Link>
                <Link
                  to="/homepage"
                  className="inline-flex items-center justify-center rounded-full bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20 transition"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container playlists-page">
      <Sidebar />

      <main className="main-content playlists-main">
        <header className="top-nav">
          <div className="breadcrumb">Your Library -.. Playlists</div>
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
            <Link to="/notifications" className="nav-link">
              <i className="fa-solid fa-bell"></i>
            </Link>
            <Link to="/account" className="nav-link">
              <i className="fa-solid fa-user"></i>
            </Link>
          </nav>
        </header>

        {showPlaylistMigrationNotice && playlistIdMigrationCount > 0 && (
          <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100 flex items-start justify-between gap-3">
            <span>
              Playlist ID migration complete: converted{" "}
              {playlistIdMigrationCount} legacy playlist
              {playlistIdMigrationCount === 1 ? "" : "s"} to UUID format.
            </span>
            <button
              type="button"
              onClick={dismissPlaylistMigrationNotice}
              className="text-yellow-200 hover:text-white transition-colors"
              aria-label="Dismiss migration notice"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* Search Input Field */}
        {showSearch && (
          <div className="search-container mb-6 playlist-search-wrap">
            <div className="relative">
              <input
                type="text"
                placeholder="Search songs to add to playlist..."
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

        {/* Search Results */}
        {showSearch && searchResults.length > 0 && (
          <div className="panel playlist-search-panel">
            <div className="section-header">
              <div className="playlist-search-top-row">
                <h3 className="playlist-search-title">
                  Search Results ({searchResults.length})
                </h3>
                <div className="playlist-target-wrap">
                  <span className="playlist-target-label">Add to</span>
                  <select
                    value={targetPlaylistId}
                    onChange={(event) =>
                      setTargetPlaylistId(event.target.value)
                    }
                    className="playlist-target-select"
                  >
                    {playlists.length === 0 ? (
                      <option value="">No playlists</option>
                    ) : (
                      playlists.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>
            <div className="playlist-search-results-list">
              {searchResults.map((song, i) => (
                <div
                  key={i}
                  className="queue-item"
                  onClick={() => handlePlaySearchResult(song, i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <img
                    src={song.cover}
                    alt={song.title}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "6px",
                      objectFit: "cover",
                    }}
                  />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "14px",
                        color: "#fff",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    >
                      {song.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "#888" }}>
                      {song.artist}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                      minWidth: "52px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {song.duration ? formatTime(song.duration) : "--:--"}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleAddSongToSelectedPlaylist(song);
                    }}
                    disabled={!targetPlaylistId}
                    title={
                      targetPlaylistId
                        ? "Add to playlist"
                        : "Create playlist first"
                    }
                    style={{
                      background: targetPlaylistId
                        ? "rgba(16, 185, 129, 0.2)"
                        : "rgba(255,255,255,0.08)",
                      color: targetPlaylistId ? "#34d399" : "#888",
                      border: "none",
                      borderRadius: "8px",
                      width: "32px",
                      height: "32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: targetPlaylistId ? "pointer" : "not-allowed",
                    }}
                  >
                    <i className="fa-solid fa-plus"></i>
                  </button>
                  <i
                    className="fa-solid fa-play"
                    style={{ color: "#cb3391" }}
                  ></i>
                </div>
              ))}
            </div>
            {actionMessage && (
              <div className="playlist-action-message">{actionMessage}</div>
            )}
          </div>
        )}

        {showSearch &&
          searchQuery &&
          searchResults.length === 0 &&
          !isSearching && (
            <div
              className="panel"
              style={{
                marginBottom: "20px",
                textAlign: "center",
                padding: "40px",
              }}
            >
              <p style={{ color: "#888" }}>
                No songs found for "{searchQuery}"
              </p>
            </div>
          )}

        {/* Playlists Section */}
        {!showSearch && (
          <>
            <section
              className="playlist-section"
              style={{ marginBottom: "20px" }}
            >
              <div className="section-header" style={{ marginBottom: "15px" }}>
                <div className="playlist-controls-row">
                  <h2 style={{ color: "#fff" }}>Your Playlists</h2>
                  <div className="playlist-filter-actions">
                    <input
                      type="text"
                      value={playlistQuery}
                      onChange={(event) => setPlaylistQuery(event.target.value)}
                      placeholder="Search playlists..."
                      className="playlist-filter-input"
                    />
                    <select
                      value={playlistSortBy}
                      onChange={(event) =>
                        setPlaylistSortBy(event.target.value)
                      }
                      className="playlist-filter-select"
                    >
                      <option value="recent">Recent</option>
                      <option value="name">Name</option>
                      <option value="songs">Most Songs</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setPlaylistQuery("");
                        setPlaylistSortBy("recent");
                      }}
                      className="playlist-clear-btn"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="playlist-create-btn"
                    >
                      <i className="fa-solid fa-plus"></i> Create Playlist
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Playlists Grid - Responsive */}
            <div className="playlists-grid">
              {filteredSortedPlaylists.length === 0 ? (
                <div className="playlist-empty-state">
                  <div className="playlist-empty-icon-wrap">
                    <i
                      className="fa-solid fa-music"
                      style={{
                        fontSize: "64px",
                        marginBottom: "20px",
                        display: "block",
                        background: "linear-gradient(270deg, #cb3391, #2d30eb)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    ></i>
                  </div>
                  <h3 className="playlist-empty-title">No playlists yet</h3>
                  <p className="playlist-empty-subtitle">
                    Create your first playlist to get started!
                  </p>
                  <button
                    onClick={() => {
                      if (playlists.length > 0) {
                        setPlaylistQuery("");
                        setPlaylistSortBy("recent");
                        return;
                      }
                      setShowCreateModal(true);
                    }}
                    className="playlist-empty-btn"
                  >
                    <i className="fa-solid fa-plus"></i>{" "}
                    {playlists.length > 0 ? "Reset Filters" : "Create Playlist"}
                  </button>
                </div>
              ) : (
                filteredSortedPlaylists.map((playlist) => {
                  const gradient = getGradientForPlaylist(playlist.name);

                  return (
                    <Link
                      key={playlist.id}
                      to={`/playlist/${playlist.id}`}
                      className="playlist-card"
                      style={{
                        background: gradient,
                        padding: "15px",
                        color: "#fff",
                        textDecoration: "none",
                        position: "relative",
                        minHeight: "140px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        overflow: "hidden",
                      }}
                    >
                      {/* Background pattern overlay */}
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background:
                            "radial-gradient(circle at top right, rgba(255,255,255,0.15) 0%, transparent 60%)",
                          pointerEvents: "none",
                        }}
                      />

                      {/* Play button on hover */}
                      <div className="playlist-card-play-indicator">
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.95)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                          }}
                        >
                          <i
                            className="fa-solid fa-play"
                            style={{
                              color: "#333",
                              fontSize: "14px",
                              marginLeft: "2px",
                            }}
                          ></i>
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ position: "relative", zIndex: 1 }}>
                        {/* Music icon with gradient background */}
                        <div
                          style={{
                            width: "35px",
                            height: "35px",
                            borderRadius: "8px",
                            background: "rgba(255,255,255,0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: "10px",
                            backdropFilter: "blur(10px)",
                          }}
                        >
                          <i
                            className="fa-solid fa-music"
                            style={{
                              fontSize: "16px",
                              color: "rgba(255,255,255,0.9)",
                            }}
                          ></i>
                        </div>
                        <h3
                          style={{
                            fontSize: "14px",
                            marginBottom: "4px",
                            fontWeight: "600",
                            textShadow: "0 2px 4px rgba(0,0,0,0.2)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {playlist.name}
                        </h3>
                        <p
                          style={{
                            fontSize: "11px",
                            opacity: 0.85,
                            fontWeight: "500",
                          }}
                        >
                          {playlist.songs.length}{" "}
                          {playlist.songs.length === 1 ? "song" : "songs"}
                        </p>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDelete(e, playlist.id)}
                        className="playlist-delete-btn"
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          background: "rgba(0,0,0,0.3)",
                          border: "none",
                          color: "#fff",
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          cursor: "pointer",
                          fontSize: "10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 2,
                        }}
                        title="Delete playlist"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>

                      {/* Decorative elements */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: "-15px",
                          right: "-15px",
                          width: "60px",
                          height: "60px",
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.1)",
                          filter: "blur(15px)",
                        }}
                      />
                    </Link>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            backdropFilter: "blur(8px)",
            animation: "fadeIn 0.2s ease",
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: "linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)",
              borderRadius: "24px",
              padding: "30px",
              width: "90%",
              maxWidth: "380px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
              animation: "slideUp 0.3s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <h2
                style={{
                  color: "#fff",
                  fontSize: "20px",
                  fontWeight: "600",
                  margin: 0,
                }}
              >
                Create Playlist
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#888",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.2)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.color = "#888";
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist}>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    color: "#888",
                    fontSize: "12px",
                    marginBottom: "8px",
                    fontWeight: "500",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Playlist Name
                </label>
                <input
                  type="text"
                  placeholder="My awesome playlist"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "2px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    fontSize: "15px",
                    transition: "all 0.2s",
                  }}
                  autoFocus
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "25px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "transparent",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "500",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  style={{
                    padding: "12px 28px",
                    borderRadius: "25px",
                    border: "none",
                    background: newPlaylistName.trim()
                      ? "linear-gradient(270deg, #cb3391, #2d30eb)"
                      : "rgba(255,255,255,0.1)",
                    color: newPlaylistName.trim() ? "#fff" : "#666",
                    cursor: newPlaylistName.trim() ? "pointer" : "not-allowed",
                    fontSize: "13px",
                    fontWeight: "600",
                    transition: "all 0.3s",
                    boxShadow: newPlaylistName.trim()
                      ? "0 4px 15px rgba(203, 51, 145, 0.4)"
                      : "none",
                  }}
                  onMouseOver={(e) => {
                    if (newPlaylistName.trim()) {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow =
                        "0 6px 20px rgba(203, 51, 145, 0.5)";
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 15px rgba(203, 51, 145, 0.4)";
                  }}
                >
                  <i
                    className="fa-solid fa-plus"
                    style={{ marginRight: "6px" }}
                  ></i>
                  Create
                </button>
              </div>
            </form>

            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideUp {
                from { 
                  opacity: 0;
                  transform: translateY(20px);
                }
                to { 
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}
