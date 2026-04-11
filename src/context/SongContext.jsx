/**
 * Song Context
 * Manages API-based song data with caching and state management
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import * as songApi from "../lib/songApi";
import { allSongs as localAllSongs } from "../data/allSongs";

const SongContext = createContext();

export const SongProvider = ({ children }) => {
  const hasBootstrappedRef = useRef(false);

  // State for songs by category
  const [englishSongs, setEnglishSongs] = useState([]);
  const [hindiSongs, setHindiSongs] = useState([]);
  const [marathiSongs, setMarathiSongs] = useState([]);
  const [trendingSongs, setTrendingSongs] = useState([]);

  // Pagination state
  const [offsets, setOffsets] = useState({
    english: 0,
    hindi: 0,
    marathi: 0,
    trending: 0,
  });

  // Has more songs state
  const [hasMore, setHasMore] = useState({
    english: true,
    hindi: true,
    marathi: true,
    trending: true,
  });

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState({
    english: false,
    hindi: false,
    marathi: false,
    trending: false,
  });

  // Error state
  const [error, setError] = useState(null);

  // API configuration state
  const [isSpotifyConfigured, setIsSpotifyConfigured] = useState(false);

  // Check Spotify configuration on mount
  useEffect(() => {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;

    const hasConfig =
      !!clientId &&
      clientId !== "" &&
      clientId !== "your_client_id_here" &&
      !!clientSecret &&
      clientSecret !== "";

    setIsSpotifyConfigured(hasConfig);
  }, []);

  // Fetch songs by category
  const fetchEnglishSongs = useCallback(
    async (limit = 20, offset = 0, append = false) => {
      setLoadingCategories((prev) => ({ ...prev, english: true }));
      setError(null);
      try {
        const songs = await songApi.fetchSongsByCategory(
          "english",
          limit,
          offset,
        );
        if (append) {
          setEnglishSongs((prev) => [...prev, ...songs]);
        } else {
          setEnglishSongs(songs);
        }
        // Update offset and hasMore
        setOffsets((prev) => ({ ...prev, english: offset + songs.length }));
        setHasMore((prev) => ({ ...prev, english: songs.length === limit }));
        return songs;
      } catch (err) {
        setError(err.message);
        return [];
      } finally {
        setLoadingCategories((prev) => ({ ...prev, english: false }));
      }
    },
    [],
  );

  const fetchHindiSongs = useCallback(
    async (limit = 20, offset = 0, append = false) => {
      setLoadingCategories((prev) => ({ ...prev, hindi: true }));
      setError(null);
      try {
        const songs = await songApi.fetchSongsByCategory(
          "hindi",
          limit,
          offset,
        );
        if (append) {
          setHindiSongs((prev) => [...prev, ...songs]);
        } else {
          setHindiSongs(songs);
        }
        // Update offset and hasMore
        setOffsets((prev) => ({ ...prev, hindi: offset + songs.length }));
        setHasMore((prev) => ({ ...prev, hindi: songs.length === limit }));
        return songs;
      } catch (err) {
        setError(err.message);
        return [];
      } finally {
        setLoadingCategories((prev) => ({ ...prev, hindi: false }));
      }
    },
    [],
  );

  const fetchMarathiSongs = useCallback(
    async (limit = 20, offset = 0, append = false) => {
      setLoadingCategories((prev) => ({ ...prev, marathi: true }));
      setError(null);
      try {
        const songs = await songApi.fetchSongsByCategory(
          "marathi",
          limit,
          offset,
        );
        if (append) {
          setMarathiSongs((prev) => [...prev, ...songs]);
        } else {
          setMarathiSongs(songs);
        }
        // Update offset and hasMore
        setOffsets((prev) => ({ ...prev, marathi: offset + songs.length }));
        setHasMore((prev) => ({ ...prev, marathi: songs.length === limit }));
        return songs;
      } catch (err) {
        setError(err.message);
        return [];
      } finally {
        setLoadingCategories((prev) => ({ ...prev, marathi: false }));
      }
    },
    [],
  );

  const fetchTrending = useCallback(
    async (market = "US", limit = 20, offset = 0, append = false) => {
      setLoadingCategories((prev) => ({ ...prev, trending: true }));
      setError(null);
      try {
        const songs = await songApi.fetchTrendingSongs(market, limit, offset);
        if (append) {
          setTrendingSongs((prev) => [...prev, ...songs]);
        } else {
          setTrendingSongs(songs);
        }
        // Update offset and hasMore
        setOffsets((prev) => ({ ...prev, trending: offset + songs.length }));
        setHasMore((prev) => ({ ...prev, trending: songs.length === limit }));
        return songs;
      } catch (err) {
        setError(err.message);
        return [];
      } finally {
        setLoadingCategories((prev) => ({ ...prev, trending: false }));
      }
    },
    [],
  );

  // Search songs
  const searchSongs = useCallback(async (query, limit = 20) => {
    setIsLoading(true);
    setError(null);
    try {
      const songs = await songApi.searchSongs(query, limit);
      return songs;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch artist with top tracks
  const fetchArtistWithTracks = useCallback(async (artistId, market = "US") => {
    setIsLoading(true);
    setError(null);
    try {
      const artistData = await songApi.fetchArtistWithTopTracks(
        artistId,
        market,
      );
      return artistData;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch album with tracks
  const fetchAlbumWithTracks = useCallback(async (albumId) => {
    setIsLoading(true);
    setError(null);
    try {
      const albumData = await songApi.fetchAlbumWithTracks(albumId);
      return albumData;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch playlist with tracks
  const fetchPlaylistWithTracks = useCallback(async (playlistId) => {
    setIsLoading(true);
    setError(null);
    try {
      const playlistData = await songApi.fetchPlaylistWithTracks(playlistId);
      return playlistData;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get all songs (combined) - includes both API songs and local songs
  const getAllSongs = useCallback(() => {
    // Combine API-fetched songs with local songs
    // We use a Set to avoid duplicates based on title and artist
    const combinedMap = new Map();

    // Add local songs first (they have priority)
    localAllSongs.forEach((song) => {
      const key = `${song.title.toLowerCase()}-${song.artist.toLowerCase()}`;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, { ...song, source: "local" });
      }
    });

    // Add API songs (only if not already present)
    [...englishSongs, ...hindiSongs, ...marathiSongs].forEach((song) => {
      const key = `${song.title.toLowerCase()}-${song.artist.toLowerCase()}`;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, { ...song, source: "api" });
      }
    });

    return Array.from(combinedMap.values());
  }, [englishSongs, hindiSongs, marathiSongs]);

  // Clear cache
  const clearCache = useCallback(() => {
    songApi.clearSongCache();
    setEnglishSongs([]);
    setHindiSongs([]);
    setMarathiSongs([]);
    setTrendingSongs([]);
  }, []);

  // Fetch initial data if Spotify is configured
  useEffect(() => {
    if (!isSpotifyConfigured || hasBootstrappedRef.current) return;

    hasBootstrappedRef.current = true;
    // Fetch only trending on bootstrap; category pages fetch their own data on demand.
    fetchTrending("US", 20);
  }, [isSpotifyConfigured, fetchTrending]);

  const value = {
    // Song data
    englishSongs,
    hindiSongs,
    marathiSongs,
    trendingSongs,
    allSongs: getAllSongs(),

    // Pagination state
    offsets,
    hasMore,

    // Loading states
    isLoading,
    loadingCategories,

    // Error state
    error,

    // API configuration
    isSpotifyConfigured,

    // Methods
    fetchEnglishSongs,
    fetchHindiSongs,
    fetchMarathiSongs,
    fetchTrending,
    searchSongs,
    fetchArtistWithTracks,
    fetchAlbumWithTracks,
    fetchPlaylistWithTracks,
    getAllSongs,
    clearCache,
  };

  return <SongContext.Provider value={value}>{children}</SongContext.Provider>;
};

export const useSongs = () => {
  const context = useContext(SongContext);
  if (!context) {
    throw new Error("useSongs must be used within a SongProvider");
  }
  return context;
};

export default SongContext;
