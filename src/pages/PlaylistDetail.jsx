import { useParams, useNavigate } from "react-router-dom";
import { useState, useRef, useCallback, useEffect } from "react";
import { usePlaylist } from "../context/PlaylistContext";
import { usePlayer } from "../context/PlayerContext";
import { useSongs } from "../context/SongContext";
import { searchAndCreateSong } from "../lib/youtube";
import { searchSpotify } from "../lib/spotify";
import { transformTrack } from "../utils/spotifyHelpers";

// Diverse gradient colors for playlist detail header
const GRADIENTS = [
  "linear-gradient(135deg, #3a3a3a 0%, #dbdbdb 100%)", // Charcoal to light gray
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

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    getPlaylist,
    removeSongFromPlaylist,
    deletePlaylist,
    addSongToPlaylist,
  } = usePlaylist();
  const { currentSong, playSong, formatTime } = usePlayer();
  const { isSpotifyConfigured, allSongs: localAllSongs } = useSongs();
  const [loadingSongIndex, setLoadingSongIndex] = useState(null);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const activeSearchIdRef = useRef(0);
  const MIN_SPOTIFY_SEARCH_LENGTH = 3;

  const playlist = getPlaylist(id);
  const playlistGradient = playlist
    ? getGradientForPlaylist(playlist.name)
    : GRADIENTS[0];

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
    };
  }, []);

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  // Add song to playlist from search result
  const handleAddToPlaylist = (song) => {
    addSongToPlaylist(id, song);
    // Show a brief feedback
    setSearchResults((prev) =>
      prev.map((s) =>
        s.title === song.title && s.artist === song.artist
          ? { ...s, added: true }
          : s,
      ),
    );
    setTimeout(() => {
      setSearchResults((prev) =>
        prev.map((s) =>
          s.title === song.title && s.artist === song.artist
            ? { ...s, added: false }
            : s,
        ),
      );
    }, 1500);
  };

  // Check if song is already in playlist
  const isSongInPlaylist = (song) => {
    if (!playlist) return false;
    return playlist.songs.some(
      (s) => s.title === song.title && s.artist === song.artist,
    );
  };

  const handleRemoveSong = async (e, songIndex) => {
    e.stopPropagation();
    removeSongFromPlaylist(id, songIndex);
  };

  const handlePlaySong = async (song, index) => {
    if (song.needsYouTubeFallback && !song.src) {
      setLoadingSongIndex(index);
      try {
        const youtubeSong = await searchAndCreateSong(song.title, song.artist);
        const updatedSong = { ...song, src: youtubeSong.src };
        const updatedPlaylist = [...playlist.songs];
        updatedPlaylist[index] = updatedSong;
        playSong(updatedPlaylist, index);
      } catch (error) {
        console.error("Error fetching YouTube source:", error);
      } finally {
        setLoadingSongIndex(null);
      }
    } else {
      playSong(playlist.songs, index);
    }
  };

  const handleDeletePlaylist = () => {
    if (window.confirm("Are you sure you want to delete this playlist?")) {
      deletePlaylist(id);
      navigate("/playlists");
    }
  };

  if (!playlist) {
    return (
      <div className="playlist-detail-empty">
        <h2 style={{ color: "#fff" }}>Playlist not found</h2>
        <button
          onClick={() => navigate("/playlists")}
          style={{
            background: "linear-gradient(270deg, #cb3391, #2d30eb)",
            color: "#fff",
            border: "none",
            padding: "12px 24px",
            borderRadius: "25px",
            cursor: "pointer",
          }}
        >
          Back to Playlists
        </button>
      </div>
    );
  }

  return (
    <div className="playlist-detail-page">
      <div
        className="playlist-detail-header"
        style={{
          background: playlistGradient,
        }}
      >
        <div className="playlist-detail-header-inner">
          <div className="playlist-detail-cover">
            <i
              className="fa-solid fa-music"
              style={{ fontSize: "78px", color: "rgba(255,255,255,0.8)" }}
            ></i>
          </div>
          <div className="playlist-detail-meta">
            <p className="playlist-detail-meta-label">Playlist</p>
            <h1>{playlist.name}</h1>
            <p className="playlist-detail-meta-count">
              {playlist.songs.length}{" "}
              {playlist.songs.length === 1 ? "song" : "songs"}
            </p>
          </div>
        </div>
      </div>

      <div className="playlist-detail-body">
        {/* Songs List */}
        <div className="playlist-detail-main">
          <div className="playlist-detail-actions-row">
            <div className="playlist-detail-actions-left">
              <button
                onClick={() => {
                  if (playlist.songs.length > 0) {
                    handlePlaySong(playlist.songs[0], 0);
                  }
                }}
                disabled={playlist.songs.length === 0}
                className="playlist-primary-circle-btn"
                style={{
                  cursor: playlist.songs.length > 0 ? "pointer" : "not-allowed",
                }}
              >
                <i
                  className="fa-solid fa-play"
                  style={{ marginLeft: "3px" }}
                ></i>
              </button>

              {/* Search Button */}
              <button
                onClick={toggleSearch}
                title="Search songs to add"
                className={`playlist-search-toggle-btn ${showSearch ? "is-open" : ""}`}
                style={{
                  cursor: "pointer",
                }}
              >
                <i
                  className={`fa-solid ${showSearch ? "fa-xmark" : "fa-magnifying-glass"}`}
                ></i>
              </button>
            </div>
          </div>

          {/* Search Input */}
          {showSearch && (
            <div className="playlist-detail-search-box">
              <input
                type="text"
                placeholder="Search songs to add to this playlist..."
                value={searchQuery}
                onChange={handleSearchInput}
                className="playlist-detail-search-input"
                autoFocus
              />

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="playlist-detail-search-results">
                  {searchResults.map((song, i) => (
                    <div
                      key={i}
                      className={`playlist-detail-search-item ${song.added ? "is-added" : ""}`}
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
                      {song.added ? (
                        <span
                          style={{
                            color: "#4caf50",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          <i className="fa-solid fa-check"></i> Added
                        </span>
                      ) : isSongInPlaylist(song) ? (
                        <span
                          style={{
                            color: "#888",
                            fontSize: "12px",
                          }}
                        >
                          Already in playlist
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddToPlaylist(song)}
                          style={{
                            background: "rgba(203, 51, 145, 0.8)",
                            border: "none",
                            color: "#fff",
                            padding: "6px 12px",
                            borderRadius: "20px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          <i className="fa-solid fa-plus"></i> Add
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isSearching && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "10px",
                    color: "#888",
                  }}
                >
                  <i className="fa-solid fa-spinner fa-spin"></i> Searching...
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !isSearching && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "10px",
                    color: "#888",
                  }}
                >
                  No songs found for "{searchQuery}"
                </div>
              )}
            </div>
          )}

          {/* Songs in playlist */}
          <div className="playlist-detail-song-list">
            {playlist.songs.length === 0 ? (
              <div className="playlist-detail-empty-songs">
                <i
                  className="fa-solid fa-music"
                  style={{
                    fontSize: "48px",
                    marginBottom: "15px",
                    display: "block",
                  }}
                ></i>
                <p>This playlist is empty</p>
                <p style={{ fontSize: "14px" }}>
                  Click the search button to add songs!
                </p>
              </div>
            ) : (
              playlist.songs.map((song, index) => (
                <div
                  key={index}
                  onClick={() => handlePlaySong(song, index)}
                  className={`playlist-detail-song-item ${currentSong?.title === song.title ? "is-active" : ""}`}
                  style={{
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      color: "#666",
                      fontSize: "14px",
                      width: "20px",
                      textAlign: "center",
                    }}
                  >
                    {loadingSongIndex === index ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      index + 1
                    )}
                  </span>
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
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "15px",
                        color: "#fff",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    >
                      {song.title}
                    </div>
                    <div style={{ fontSize: "13px", color: "#888" }}>
                      {song.artist}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                      minWidth: "56px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {song.duration ? formatTime(song.duration) : "--:--"}
                  </div>
                  <button
                    onClick={(e) => handleRemoveSong(e, index)}
                    className="playlist-remove-btn"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#666",
                      cursor: "pointer",
                      padding: "8px",
                      borderRadius: "50%",
                    }}
                  >
                    <i className="fa-solid fa-minus"></i>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar info */}
        <div className="playlist-detail-side">
          <div className="playlist-detail-side-sticky">
            <div className="playlist-detail-side-actions">
              <button
                onClick={() => {
                  if (playlist.songs.length > 0) {
                    handlePlaySong(playlist.songs[0], 0);
                  }
                }}
                disabled={playlist.songs.length === 0}
                className="playlist-secondary-pill-btn"
                style={{
                  cursor: playlist.songs.length > 0 ? "pointer" : "not-allowed",
                }}
              >
                <i className="fa-solid fa-play"></i> Play All
              </button>

              <button
                onClick={handleDeletePlaylist}
                className="playlist-danger-pill-btn"
                style={{
                  cursor: "pointer",
                }}
              >
                <i className="fa-solid fa-trash"></i> Delete
              </button>
            </div>

            <div className="lyrics-panel playlist-detail-about">
              <h3 className="playlist-detail-about-title">
                <i
                  className="fa-solid fa-circle-info"
                  style={{ color: "#cb3391" }}
                ></i>
                About this playlist
              </h3>
              <p className="playlist-detail-about-date">
                Created on{" "}
                {playlist.createdAt
                  ? new Date(playlist.createdAt).toLocaleDateString()
                  : "Unknown"}
              </p>
              <p className="playlist-detail-about-help">
                Add songs to this playlist by clicking the{" "}
                <i
                  className="fa-solid fa-plus"
                  style={{ color: "#cb3391" }}
                ></i>{" "}
                button on any song.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
