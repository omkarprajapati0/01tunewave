import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import * as spotifyAPI from "../lib/spotify";
import { isYouTubeAPIConfigured } from "../lib/youtube";
import {
  transformTrack,
  transformArtist,
  transformAlbum,
  transformPlaylist,
} from "../utils/spotifyHelpers";

const SpotifyContext = createContext();
const IS_DEV = import.meta.env.DEV;

export const SpotifyProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState({
    tracks: [],
    artists: [],
    albums: [],
    playlists: [],
  });
  const [featuredPlaylists, setFeaturedPlaylists] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isConfigured, setIsConfigured] = useState(true);
  const [configDetails, setConfigDetails] = useState({
    hasClientId: false,
    hasClientSecret: false,
    isValidFormat: false,
    testedAt: null,
    testStatus: null,
    error: null,
  });
  const [detailedError, setDetailedError] = useState(null);

  // Check if Spotify is configured - auto-check on mount
  useEffect(() => {
    const spotifyConfig = spotifyAPI.checkSpotifyConfig();
    const youtubeConfigured = isYouTubeAPIConfigured();

    setConfigDetails({
      hasClientId: spotifyConfig.hasClientId,
      hasClientSecret: spotifyConfig.hasClientSecret,
      isValidFormat: spotifyConfig.isConfigured,
      youtubeConfigured,
      testedAt: null,
      testStatus: null,
      error: null,
    });

    if (spotifyConfig.isConfigured) {
      setIsConfigured(true);
      console.log("✅ Spotify is configured and ready!");
      console.log("   Client ID:", spotifyConfig.clientIdPrefix);
      if (youtubeConfigured) {
        console.log("✅ YouTube Data API is also configured");
      } else {
        console.log(
          "ℹ️ YouTube Data API not configured (will use fallback methods)",
        );
      }
    } else {
      setIsConfigured(false);
      if (IS_DEV) {
        console.warn("⚠️ Spotify is NOT configured properly.");
        console.warn(
          "   Missing:",
          !spotifyConfig.hasClientId ? "Client ID" : "",
          !spotifyConfig.hasClientSecret ? "Client Secret" : "",
        );
        console.warn("   Please add credentials to .env file.");
      }
    }
  }, []);

  // Check if Spotify is configured (manual check)
  const checkConfiguration = useCallback(() => {
    const spotifyConfig = spotifyAPI.checkSpotifyConfig();

    setConfigDetails((prev) => ({
      ...prev,
      hasClientId: spotifyConfig.hasClientId,
      hasClientSecret: spotifyConfig.hasClientSecret,
      isValidFormat: spotifyConfig.isConfigured,
    }));

    setIsConfigured(spotifyConfig.isConfigured);
    return spotifyConfig.isConfigured;
  }, []);

  // Test Spotify connection
  const testConnection = useCallback(async () => {
    console.log("🧪 Testing Spotify connection...");
    setConfigDetails((prev) => ({
      ...prev,
      testStatus: "testing",
      error: null,
    }));
    setDetailedError(null);

    try {
      const token = await spotifyAPI.getAccessToken();
      console.log("✅ Spotify connection test successful!");
      console.log("   Token received:", token.substring(0, 20) + "...");
      setConfigDetails((prev) => ({
        ...prev,
        testedAt: new Date().toISOString(),
        testStatus: "success",
        error: null,
      }));
      return { success: true, message: "Connection successful!" };
    } catch (err) {
      if (IS_DEV) {
        console.error("❌ Spotify connection test failed:", err.message);
      }
      setConfigDetails((prev) => ({
        ...prev,
        testedAt: new Date().toISOString(),
        testStatus: "failed",
        error: err.message,
      }));
      setDetailedError({
        message: err.message,
        code: err.code,
        status: err.status,
        timestamp: new Date().toISOString(),
      });
      return { success: false, message: err.message, code: err.code };
    }
  }, []);

  // Search Spotify
  const search = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults({ tracks: [], artists: [], albums: [], playlists: [] });
      return;
    }

    setIsLoading(true);
    setError(null);
    setDetailedError(null);

    try {
      const results = await spotifyAPI.searchSpotify(query);

      setSearchResults({
        tracks: results.tracks?.items.map(transformTrack).filter(Boolean) || [],
        artists:
          results.artists?.items.map(transformArtist).filter(Boolean) || [],
        albums: results.albums?.items.map(transformAlbum).filter(Boolean) || [],
        playlists:
          results.playlists?.items.map(transformPlaylist).filter(Boolean) || [],
      });
    } catch (err) {
      if (IS_DEV) {
        console.error("Search error:", err);
      }
      setError(err.message);
      setDetailedError({
        message: err.message,
        code: err.code,
        status: err.status,
        timestamp: new Date().toISOString(),
      });
      setSearchResults({ tracks: [], artists: [], albums: [], playlists: [] });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get featured playlists - DISABLED (API returns 404)
  const fetchFeaturedPlaylists = useCallback(async () => {
    // This endpoint is disabled - Spotify API returns 404 for featured playlists
    // with client credentials flow. Returning empty array.
    console.log("Featured playlists API disabled - using empty fallback");
    setFeaturedPlaylists([]);
  }, []);

  // Get new releases
  const fetchNewReleases = useCallback(async (country = "US") => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await spotifyAPI.getNewReleases(country);
      setNewReleases(
        results.albums?.items.map(transformAlbum).filter(Boolean) || [],
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get categories
  const fetchCategories = useCallback(async (country = "US") => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await spotifyAPI.getCategories(country);
      setCategories(results.categories?.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get artist details
  const fetchArtist = useCallback(async (artistId) => {
    setIsLoading(true);
    setError(null);

    try {
      const artist = await spotifyAPI.getArtist(artistId);
      return transformArtist(artist);
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get artist's top tracks
  const fetchArtistTopTracks = useCallback(async (artistId, country = "US") => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await spotifyAPI.getArtistTopTracks(artistId, country);
      return results.tracks?.map(transformTrack).filter(Boolean) || [];
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get related artists
  const fetchRelatedArtists = useCallback(async (artistId) => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await spotifyAPI.getRelatedArtists(artistId);
      return results.artists?.map(transformArtist).filter(Boolean) || [];
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get album details
  const fetchAlbum = useCallback(async (albumId) => {
    setIsLoading(true);
    setError(null);

    try {
      const album = await spotifyAPI.getAlbum(albumId);
      return transformAlbum(album);
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get album tracks
  const fetchAlbumTracks = useCallback(async (albumId) => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await spotifyAPI.getAlbumTracks(albumId);
      return results.items?.map(transformTrack).filter(Boolean) || [];
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get playlist details
  const fetchPlaylist = useCallback(async (playlistId) => {
    setIsLoading(true);
    setError(null);

    try {
      const playlist = await spotifyAPI.getPlaylist(playlistId);
      return transformPlaylist(playlist);
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get recommendations - DISABLED (API returns 404)
  const fetchRecommendations = useCallback(async () => {
    // This endpoint is disabled - Spotify API returns 404 for recommendations
    // with client credentials flow. Returning empty array.
    console.log("Recommendations API disabled - using empty fallback");
    return [];
  }, []);

  // Clear search results
  const clearSearch = useCallback(() => {
    setSearchResults({ tracks: [], artists: [], albums: [], playlists: [] });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Retry last failed operation
  const retryLastOperation = useCallback(async () => {
    if (detailedError) {
      // Clear error and retry
      setError(null);
      setDetailedError(null);
      spotifyAPI.clearLastError();
      return true;
    }
    return false;
  }, [detailedError]);

  const value = {
    // State
    isLoading,
    error,
    detailedError,
    searchResults,
    featuredPlaylists,
    newReleases,
    categories,
    isConfigured,
    configDetails,
    checkConfiguration,

    // Methods
    search,
    fetchFeaturedPlaylists,
    fetchNewReleases,
    fetchCategories,
    fetchArtist,
    fetchArtistTopTracks,
    fetchRelatedArtists,
    fetchAlbum,
    fetchAlbumTracks,
    fetchPlaylist,
    fetchRecommendations,
    clearSearch,
    clearError,
    testConnection,
    retryLastOperation,
    resetSpotifyToken: spotifyAPI.resetToken,
  };

  return (
    <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>
  );
};

export const useSpotify = () => {
  const context = useContext(SpotifyContext);
  if (!context) {
    throw new Error("useSpotify must be used within a SpotifyProvider");
  }
  return context;
};

export default SpotifyContext;
