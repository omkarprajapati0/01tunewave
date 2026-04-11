import { useState, useEffect } from "react";
import { useSpotify } from "../context/SpotifyContext";
import { usePlayer } from "../context/PlayerContext";
import { usePlaylist } from "../context/PlaylistContext";
import { formatDuration } from "../utils/spotifyHelpers";
import { searchAndCreateSong } from "../lib/youtube";

const SpotifySearch = () => {
  const MIN_SPOTIFY_SEARCH_LENGTH = 3;
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("tracks");
  const [notification, setNotification] = useState(null);
  const [youtubeLoading, setYoutubeLoading] = useState(false);

  const {
    searchResults,
    isLoading,
    error,
    detailedError,
    search,
    clearSearch,
    isConfigured,
    configDetails,
    testConnection,
    retryLastOperation,
    resetSpotifyToken,
  } = useSpotify();

  const { playSong, currentSong, playing } = usePlayer();
  const { addToFavorites, addSongToPlaylist, playlists } = usePlaylist();

  // Show notification helper
  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= MIN_SPOTIFY_SEARCH_LENGTH) {
        search(query);
      } else {
        clearSearch();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, search, clearSearch]);

  // Handle retry
  const handleRetry = async () => {
    await retryLastOperation();
    if (query.trim()) {
      search(query);
    }
  };

  // Handle test connection
  const handleTestConnection = async () => {
    const result = await testConnection();
    showNotification(
      result.success ? "Connection successful!" : result.message,
      result.success ? "success" : "error",
    );
  };

  const handlePlayTrack = async (track) => {
    console.log("🎵 handlePlayTrack called for:", track.title, track.artist);

    // Check if track has a direct playable source (Spotify preview)
    if (track.src && track.src.startsWith("http")) {
      console.log("  ✅ Playing from Spotify preview URL");
      // Filter only playable tracks with direct sources
      const playableTracks = searchResults.tracks.filter(
        (t) => t.src && t.src.startsWith("http"),
      );
      const trackIndex = playableTracks.findIndex(
        (t) => t.spotifyId === track.spotifyId,
      );

      if (trackIndex !== -1) {
        playSong(playableTracks, trackIndex);
        return;
      }
    }

    // If no direct source, try YouTube fallback - ONLY for the clicked track first
    if (track.needsYouTubeFallback || !track.src) {
      setYoutubeLoading(true);
      showNotification("Searching on YouTube...", "info");

      try {
        // First, search YouTube for ONLY the clicked track (fast!)
        console.log(
          "  🔍 Searching YouTube for:",
          track.title,
          "-",
          track.artist,
        );
        const youtubeSong = await searchAndCreateSong(
          track.title,
          track.artist,
        );

        if (youtubeSong) {
          console.log("  ✅ YouTube song found:", youtubeSong.src);
          // Create playable track with YouTube source
          const playableTrack = {
            ...track,
            src: youtubeSong.src,
            srcType: "youtube",
            cover: youtubeSong.cover || track.cover,
            duration: youtubeSong.duration || track.duration,
            youtubeTitle: youtubeSong.youtubeTitle,
          };

          // Play just this one track first (instant playback)
          playSong([playableTrack], 0);
          showNotification("Playing from YouTube", "success");

          // Then in background, load more tracks for the playlist
          loadMoreTracksInBackground(track);
        } else {
          console.log("  ❌ No YouTube result found");
          showNotification("Could not find song on YouTube", "error");
        }
      } catch (error) {
        console.error("YouTube search error:", error);
        showNotification("Error searching YouTube", "error");
      } finally {
        setYoutubeLoading(false);
      }
    }
  };

  // Background loading - load more tracks from YouTube after first one plays
  const loadMoreTracksInBackground = async (originalTrack) => {
    try {
      // Get tracks excluding the one we already loaded
      const tracksToLoad = searchResults.tracks
        .filter((t) => t.spotifyId !== originalTrack.spotifyId)
        .slice(0, 5);

      if (tracksToLoad.length === 0) return;

      console.log("  📝 Loading more tracks in background...");

      // Search YouTube for remaining tracks in background
      const youtubeSongs = await Promise.all(
        tracksToLoad.map((t) => searchAndCreateSong(t.title, t.artist)),
      );

      // Log how many were found
      const foundCount = youtubeSongs.filter((s) => s !== null).length;
      console.log(`  ✅ Loaded ${foundCount} more tracks from YouTube`);
    } catch (error) {
      console.error("Background track loading error:", error);
    }
  };

  const handleAddToFavorites = (track) => {
    addToFavorites(track);
  };

  const handleAddToPlaylist = (track, playlistId) => {
    addSongToPlaylist(playlistId, track);
  };

  if (!isConfigured) {
    return (
      <div className="p-6 bg-gray-800 rounded-lg">
        <div className="text-center text-yellow-400">
          <p className="text-lg font-semibold">Spotify Not Configured</p>
          <p className="text-sm mt-2">
            To enable Spotify integration, add your Spotify API credentials to
            the environment variables:
          </p>
          <div className="mt-4 p-4 bg-gray-900 rounded text-left text-sm font-mono">
            <p>VITE_SPOTIFY_CLIENT_ID=your_client_id</p>
            <p>VITE_SPOTIFY_CLIENT_SECRET=your_client_secret</p>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Get your credentials from{" "}
            <a
              href="https://developer.spotify.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:underline"
            >
              Spotify Developer Dashboard
            </a>
          </p>
          {configDetails.youtubeConfigured && (
            <p className="mt-2 text-xs text-green-400">
              ✅ YouTube Data API is configured
            </p>
          )}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "tracks", label: "Songs" },
    { id: "artists", label: "Artists" },
    { id: "albums", label: "Albums" },
    { id: "playlists", label: "Playlists" },
  ];

  const currentResults = searchResults[activeTab] || [];

  return (
    <div className="p-4">
      {/* Search Input */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for songs, artists, albums, or playlists..."
            className="w-full px-4 py-3 pl-12 pr-12 bg-gray-800 border border-gray-700 rounded-lg 
                       text-white placeholder-gray-400 focus:outline-none focus:border-green-500
                       transition-colors"
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
          {query && (
            <button
              onClick={() => setQuery("")}
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
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-red-200 font-medium">{error}</p>
              {detailedError?.code && (
                <p className="text-red-300/70 text-xs mt-1">
                  Error code: {detailedError.code}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleRetry}
                  className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded transition-colors flex items-center gap-1"
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Retry
                </button>
                <button
                  onClick={handleTestConnection}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                >
                  Test Connection
                </button>
                {detailedError?.code?.includes("401") && (
                  <button
                    onClick={resetSpotifyToken}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                  >
                    Reset Token
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className="mb-4 p-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200">
          {notification.message}
        </div>
      )}

      {/* Tabs */}
      {query.trim() && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-green-500 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="ml-2 text-xs">({currentResults.length})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {(isLoading || youtubeLoading) && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
          {youtubeLoading && (
            <span className="ml-3 text-gray-400">Searching YouTube...</span>
          )}
        </div>
      )}

      {/* Results */}
      {!isLoading && query.trim() && currentResults.length > 0 && (
        <div className="space-y-2">
          {/* Tracks */}
          {activeTab === "tracks" && (
            <div className="space-y-1">
              {currentResults.filter(Boolean).map((track, index) => {
                const isCurrentlyPlaying =
                  currentSong?.spotifyId === track.spotifyId ||
                  (currentSong?.title === track.title &&
                    currentSong?.artist === track.artist);

                return (
                  <div
                    key={track.spotifyId || index}
                    className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 
                               group cursor-pointer transition-colors ${
                                 isCurrentlyPlaying
                                   ? "bg-gray-800 border-l-4 border-green-500"
                                   : ""
                               }`}
                    onClick={() => handlePlayTrack(track)}
                  >
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <img
                        src={track.cover}
                        alt={track.title}
                        className="w-full h-full object-cover rounded"
                      />
                      <div
                        className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${
                          isCurrentlyPlaying
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {isCurrentlyPlaying && playing ? (
                          <div className="flex gap-0.5 items-end h-4">
                            <div className="w-1 bg-green-500 animate-pulse h-2"></div>
                            <div className="w-1 bg-green-500 animate-pulse h-3 delay-75"></div>
                            <div className="w-1 bg-green-500 animate-pulse h-4 delay-150"></div>
                          </div>
                        ) : (
                          <svg
                            className="w-6 h-6 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-medium truncate ${
                          isCurrentlyPlaying ? "text-green-500" : "text-white"
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-gray-400 text-sm truncate">
                        {track.artist}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">
                        {formatDuration(track.duration * 1000)}
                      </span>

                      {track.explicit && (
                        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                          E
                        </span>
                      )}

                      {/* Add to Favorites */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToFavorites(track);
                        }}
                        className="p-2 text-gray-400 hover:text-green-500 transition-colors"
                        title="Add to Favorites"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                      </button>

                      {/* Add to Playlist */}
                      <div className="relative group">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 text-gray-400 hover:text-green-500 transition-colors"
                          title="Add to Playlist"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </button>

                        {/* Playlist Dropdown */}
                        <div
                          className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 
                                        rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 
                                        group-hover:visible transition-all z-50"
                        >
                          <div className="p-2">
                            <p className="text-xs text-gray-400 px-2 py-1">
                              Add to playlist
                            </p>
                            {playlists.map((playlist) => (
                              <button
                                key={playlist.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToPlaylist(track, playlist.id);
                                }}
                                className="w-full text-left px-2 py-2 text-sm text-gray-200 
                                           hover:bg-gray-700 rounded transition-colors"
                              >
                                {playlist.name}
                              </button>
                            ))}
                            {playlists.length === 0 && (
                              <p className="text-xs text-gray-500 px-2 py-2">
                                No playlists yet
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Artists */}
          {activeTab === "artists" && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {currentResults.filter(Boolean).map((artist, index) => (
                <div
                  key={artist.spotifyId || index}
                  className="p-4 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer 
                             transition-colors text-center"
                >
                  <img
                    src={artist.image}
                    alt={artist.name}
                    className="w-24 h-24 mx-auto rounded-full object-cover mb-3"
                  />
                  <p className="text-white font-medium truncate">
                    {artist.name}
                  </p>
                  <p className="text-gray-400 text-sm">Artist</p>
                </div>
              ))}
            </div>
          )}

          {/* Albums */}
          {activeTab === "albums" && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {currentResults.filter(Boolean).map((album, index) => (
                <div
                  key={album.spotifyId || index}
                  className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer 
                             transition-colors"
                >
                  <img
                    src={album.cover}
                    alt={album.title}
                    className="w-full aspect-square object-cover rounded mb-3"
                  />
                  <p className="text-white font-medium truncate">
                    {album.title}
                  </p>
                  <p className="text-gray-400 text-sm truncate">
                    {album.artist}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {album.releaseDate?.split("-")[0]} • {album.albumType}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Playlists */}
          {activeTab === "playlists" && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {currentResults.filter(Boolean).map((playlist, index) => (
                <div
                  key={playlist.spotifyId || index}
                  className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer 
                             transition-colors"
                >
                  <img
                    src={playlist.cover}
                    alt={playlist.name}
                    className="w-full aspect-square object-cover rounded mb-3"
                  />
                  <p className="text-white font-medium truncate">
                    {playlist.name}
                  </p>
                  <p className="text-gray-400 text-sm truncate">
                    {playlist.owner}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!query.trim() && !isLoading && (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 mx-auto text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-gray-400 text-lg">Search for music on Spotify</p>
          <p className="text-gray-500 text-sm mt-2">
            Find songs, artists, albums, and playlists
          </p>
          {configDetails.testStatus === "failed" && (
            <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg max-w-md mx-auto">
              <p className="text-yellow-400 text-sm">
                ⚠️ Connection test failed. Some features may not work.
              </p>
              <button
                onClick={handleTestConnection}
                className="mt-2 text-xs text-yellow-400 hover:text-yellow-300 underline"
              >
                Test again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpotifySearch;
