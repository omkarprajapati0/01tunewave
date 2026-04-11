import { useEffect, useRef, useState } from "react";
import { useSpotify } from "../context/SpotifyContext";
import { usePlayer } from "../context/PlayerContext";
import { usePlaylist } from "../context/PlaylistContext";
import SpotifySearch from "../components/SpotifySearch";
import { searchAndCreateSong } from "../lib/youtube";

const Spotify = () => {
  const [activeSection, setActiveSection] = useState("search");
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const didInitialFetchRef = useRef(false);
  const COVER_FALLBACK_IMAGE = "/Logo-icon.png";
  const {
    isLoading,
    error,
    featuredPlaylists,
    newReleases,
    fetchFeaturedPlaylists,
    fetchNewReleases,
    isConfigured,
  } = useSpotify();

  const { playSong } = usePlayer();
  const { importSpotifyPlaylist } = usePlaylist();

  // Show notification helper
  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    if (!isConfigured || didInitialFetchRef.current) return;

    didInitialFetchRef.current = true;
    fetchFeaturedPlaylists();
    fetchNewReleases();
  }, [isConfigured, fetchFeaturedPlaylists, fetchNewReleases]);

  const handlePlayPlaylist = async (playlist, startIndex = 0) => {
    // Get all tracks from playlist
    const allTracks = playlist.tracks || [];

    // Separate tracks with direct sources from those needing YouTube fallback
    const tracksWithDirectSource = allTracks.filter(
      (t) => t.src && t.src.startsWith("http"),
    );
    const tracksNeedingFallback = allTracks.filter(
      (t) => !t.src || t.needsYouTubeFallback,
    );

    // If we have direct sources, play them
    if (tracksWithDirectSource.length > 0) {
      playSong(tracksWithDirectSource, startIndex);
      return;
    }

    // If no direct sources, try to get YouTube versions for all tracks
    if (tracksNeedingFallback.length > 0) {
      setYoutubeLoading(true);
      showNotification("Searching playlist on YouTube...", "info");

      try {
        // Get YouTube versions for tracks (limit to first 10 for performance)
        const tracksToProcess = tracksNeedingFallback.slice(0, 10);
        const youtubeSongs = await Promise.all(
          tracksToProcess.map((track) =>
            searchAndCreateSong(track.title, track.artist),
          ),
        );

        // Filter out failed searches and merge with Spotify metadata
        const playableYouTubeSongs = youtubeSongs
          .filter((song) => song !== null)
          .map((youtubeSong, index) => ({
            ...tracksToProcess[index],
            src: youtubeSong.src,
            srcType: "youtube",
            cover: youtubeSong.cover || tracksToProcess[index].cover,
            duration: youtubeSong.duration || tracksToProcess[index].duration,
            youtubeTitle: youtubeSong.youtubeTitle,
          }));

        if (playableYouTubeSongs.length > 0) {
          playSong(
            playableYouTubeSongs,
            Math.min(startIndex, playableYouTubeSongs.length - 1),
          );
          showNotification(
            `Playing ${playableYouTubeSongs.length} songs from YouTube`,
            "success",
          );
        } else {
          showNotification("Could not find playable songs on YouTube", "error");
        }
      } catch (error) {
        console.error("YouTube playlist search error:", error);
        showNotification("Error searching YouTube", "error");
      } finally {
        setYoutubeLoading(false);
      }
    }
  };

  const handleImportPlaylist = (playlist) => {
    importSpotifyPlaylist(playlist);
  };

  if (!isConfigured) {
    return (
      <div className="standalone-page-shell">
        <div className="standalone-page-panel max-w-4xl">
          <h1 className="standalone-page-title">Spotify</h1>
          <p className="standalone-page-subtitle mb-6">
            Connect Spotify credentials to unlock search, featured playlists,
            and new releases.
          </p>
          <div className="p-6 bg-gray-800/70 rounded-lg border border-white/10">
            <div className="text-center text-yellow-400">
              <p className="text-lg font-semibold">Spotify Not Configured</p>
              <p className="text-sm mt-2">
                To enable Spotify integration, add your Spotify API credentials
                to your deployment environment variables:
              </p>
              <div className="mt-4 p-4 bg-gray-900 rounded text-left text-sm font-mono">
                <p>VITE_SPOTIFY_CLIENT_ID=your_client_id</p>
                <p>VITE_SPOTIFY_CLIENT_SECRET=your_client_secret</p>
              </div>
              <p className="mt-4 text-xs text-gray-400">
                The app uses a server-side token endpoint in production.
              </p>
              <p className="mt-2 text-xs text-gray-400">
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sections = [
    { id: "search", label: "Search" },
    { id: "featured", label: "Featured Playlists" },
    { id: "new", label: "New Releases" },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-green-900 to-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <h1 className="text-4xl font-bold">Spotify</h1>
          <p className="text-gray-400 mt-2">
            Search and discover music from Spotify
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex gap-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                activeSection === section.id
                  ? "bg-green-500 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-6xl mx-auto px-6 mb-4">
          <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className="max-w-6xl mx-auto px-6 mb-4">
          <div
            className={`p-4 rounded-lg ${
              notification.type === "error"
                ? "bg-red-900/50 border border-red-500 text-red-200"
                : notification.type === "success"
                  ? "bg-green-900/50 border border-green-500 text-green-200"
                  : "bg-blue-900/50 border border-blue-500 text-blue-200"
            }`}
          >
            {notification.message}
          </div>
        </div>
      )}

      {/* YouTube Loading */}
      {youtubeLoading && (
        <div className="max-w-6xl mx-auto px-6 mb-4">
          <div className="p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-3"></div>
              <span className="text-blue-200">Searching on YouTube...</span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 pb-6">
        {/* Search Section */}
        {activeSection === "search" && <SpotifySearch />}

        {/* Featured Playlists Section */}
        {activeSection === "featured" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Featured Playlists</h2>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {featuredPlaylists.map((playlist) => (
                  <div
                    key={playlist.spotifyId}
                    className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors group"
                    onClick={() => handlePlayPlaylist(playlist)}
                  >
                    <div className="relative">
                      <img
                        src={playlist.cover || COVER_FALLBACK_IMAGE}
                        alt={playlist.name}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = COVER_FALLBACK_IMAGE;
                        }}
                        className="w-full aspect-square object-cover rounded mb-3"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <svg
                          className="w-12 h-12 text-white"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    <p className="font-medium truncate">{playlist.name}</p>
                    <p className="text-gray-400 text-sm truncate">
                      {playlist.owner}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImportPlaylist(playlist);
                        }}
                        className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded transition-colors"
                      >
                        Import
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* New Releases Section */}
        {activeSection === "new" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">New Releases</h2>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {newReleases.map((album) => (
                  <div
                    key={album.spotifyId}
                    className="p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <img
                      src={album.cover || COVER_FALLBACK_IMAGE}
                      alt={album.title}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = COVER_FALLBACK_IMAGE;
                      }}
                      className="w-full aspect-square object-cover rounded mb-3"
                    />
                    <p className="font-medium truncate">{album.title}</p>
                    <p className="text-gray-400 text-sm truncate">
                      {album.artist}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {album.releaseDate?.split("-")[0]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Spotify;
