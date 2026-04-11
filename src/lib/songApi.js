/**
 * Song API Service
 * Unified API service for fetching songs from Spotify and YouTube
 */

import * as spotifyAPI from "./spotify";
import { searchYouTube } from "./youtube";
import {
  transformTrack,
  transformArtist,
  getArtistNames,
  getCoverImage,
} from "../utils/spotifyHelpers";

// Genre/Category mapping for different markets
// Note: Spotify recommendations API is disabled - using search only to avoid 404 errors
// The recommendations endpoint requires special permissions that may not be available
const GENRE_MAPPING = {
  english: {
    // Skip recommendations - use search only (recommendations API returns 404)
    seedGenres: null,
    market: "US",
    searchQuery: "popular english songs",
  },
  hindi: {
    // Skip recommendations - use search only
    seedGenres: null,
    market: "IN",
    searchQuery: "bollywood hindi songs",
  },
  marathi: {
    // Skip recommendations - use search only
    seedGenres: null,
    market: "IN",
    searchQuery: "marathi songs",
  },
};

// Cache for storing fetched songs
const songCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Check if cache is valid
 */
const isCacheValid = (key) => {
  const cached = songCache.get(key);
  if (!cached) return false;
  return Date.now() - cached.timestamp < CACHE_DURATION;
};

/**
 * Get cached songs
 */
const getCachedSongs = (key) => {
  const cached = songCache.get(key);
  if (cached && isCacheValid(key)) {
    return cached.data;
  }
  return null;
};

/**
 * Cache songs
 */
const cacheSongs = (key, data) => {
  songCache.set(key, {
    data,
    timestamp: Date.now(),
  });
};

/**
 * Fetch songs from Spotify with fallback to YouTube
 * @param {string} category - Category (english, hindi, marathi)
 * @param {number} limit - Number of songs to fetch
 * @param {number} offset - Number of songs to skip (for pagination)
 * @returns {Promise<Array>} Array of song objects
 */
export const fetchSongsByCategory = async (
  category = "english",
  limit = 20,
  offset = 0,
) => {
  const cacheKey = `songs_${category}_${limit}_${offset}`;

  // Check cache first
  const cached = getCachedSongs(cacheKey);
  if (cached) {
    return cached;
  }

  const config = GENRE_MAPPING[category] || GENRE_MAPPING.english;

  try {
    // Always use search - recommendations API is disabled due to 404 errors
    console.log(
      `Fetching ${category} songs via search (offset: ${offset}, limit: ${limit})`,
    );
    const searchResults = await spotifyAPI.searchSpotify(
      config.searchQuery,
      "track",
      limit,
      offset,
    );
    const tracks = searchResults?.tracks?.items || [];

    const songs = await Promise.all(
      tracks.map(async (track) => {
        const song = transformTrack(track);

        // If no preview URL, try to get YouTube fallback
        if (!song.src) {
          try {
            const youtubeResult = await searchYouTube(
              `${song.title} ${song.artist} official audio`,
            );
            if (youtubeResult.success) {
              song.src = youtubeResult.videoId;
              song.srcType = "youtube";
              song.cover = `https://img.youtube.com/vi/${youtubeResult.videoId}/mqdefault.jpg`;
            }
          } catch (youtubeError) {
            // Log error but don't fail the entire batch
            console.warn(
              `YouTube fallback failed for ${song.title}:`,
              youtubeError.message,
            );
          }
        }

        return song;
      }),
    );

    // Filter out songs without any playable source
    const validSongs = songs.filter(
      (song) =>
        song.src && (song.srcType === "spotify" || song.srcType === "youtube"),
    );

    // Cache the results
    cacheSongs(cacheKey, validSongs);
    return validSongs;
  } catch (error) {
    console.error(`Error fetching ${category} songs:`, error);
    return [];
  }
};

/**
 * Fetch trending/recommended songs
 * @param {string} market - Country code
 * @param {number} limit - Number of songs
 * @returns {Promise<Array>} Array of song objects
 */
export const fetchTrendingSongs = async (
  market = "US",
  limit = 20,
  offset = 0,
) => {
  const cacheKey = `trending_${market}_${limit}_${offset}`;

  // Check cache first
  const cached = getCachedSongs(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Use search for trending songs (most reliable method)
    console.log(
      `Fetching trending songs via search (offset: ${offset}, limit: ${limit})`,
    );
    const searchResults = await spotifyAPI.searchSpotify(
      "trending popular hits",
      "track",
      limit,
      offset,
    );
    let tracks = searchResults?.tracks?.items || [];

    // Fallback to new releases if search returns nothing
    if (tracks.length === 0) {
      console.log("Search returned no results, trying new releases");
      try {
        const newReleases = await spotifyAPI.getNewReleases(market, 10);
        if (newReleases?.albums?.items) {
          const trackIds = [];
          for (const album of newReleases.albums.items.slice(0, 3)) {
            try {
              const albumTracks = await spotifyAPI.getAlbumTracks(album.id, 3);
              if (albumTracks?.items) {
                trackIds.push(...albumTracks.items.map((t) => t.id));
              }
            } catch {
              // Skip failed album fetches
            }
          }
          if (trackIds.length > 0) {
            const uniqueIds = [...new Set(trackIds)].slice(0, limit);
            const tracksResponse = await spotifyAPI.getTracks(uniqueIds);
            tracks = tracksResponse?.tracks || [];
          }
        }
      } catch (e) {
        console.log("New releases fetch failed:", e.message);
      }
    }

    const songs = await Promise.all(
      tracks.map(async (track) => {
        const song = transformTrack(track);

        // If no preview URL, try to get YouTube fallback
        if (!song.src) {
          try {
            const youtubeResult = await searchYouTube(
              `${song.title} ${song.artist} official audio`,
            );
            if (youtubeResult.success) {
              song.src = youtubeResult.videoId;
              song.srcType = "youtube";
              song.cover = `https://img.youtube.com/vi/${youtubeResult.videoId}/mqdefault.jpg`;
            }
          } catch (youtubeError) {
            // Log error but don't fail the entire batch
            console.warn(
              `YouTube fallback failed for ${song.title}:`,
              youtubeError.message,
            );
          }
        }

        return song;
      }),
    );

    // Filter out songs without any playable source
    const validSongs = songs.filter(
      (song) =>
        song.src && (song.srcType === "spotify" || song.srcType === "youtube"),
    );

    cacheSongs(cacheKey, validSongs);
    return validSongs;
  } catch (error) {
    console.error("Error fetching trending songs:", error);
    return [];
  }
};

/**
 * Search songs from Spotify
 * @param {string} query - Search query
 * @param {number} limit - Number of results
 * @returns {Promise<Array>} Array of song objects
 */
export const searchSongs = async (query, limit = 20) => {
  if (!query.trim()) return [];

  try {
    const results = await spotifyAPI.searchSpotify(query, "track", limit);
    const tracks = results.tracks?.items || [];

    const songs = await Promise.all(
      tracks.map(async (track) => {
        const song = transformTrack(track);

        // If no preview URL, try to get YouTube fallback
        if (!song.src) {
          try {
            const youtubeResult = await searchYouTube(
              `${song.title} ${song.artist} official audio`,
            );
            if (youtubeResult.success) {
              song.src = youtubeResult.videoId;
              song.srcType = "youtube";
              song.cover = `https://img.youtube.com/vi/${youtubeResult.videoId}/mqdefault.jpg`;
            }
          } catch (youtubeError) {
            // Log error but don't fail the entire batch
            console.warn(
              `YouTube fallback failed for ${song.title}:`,
              youtubeError.message,
            );
          }
        }

        return song;
      }),
    );

    return songs.filter(Boolean);
  } catch (error) {
    console.error("Error searching songs:", error);
    return [];
  }
};

/**
 * Fetch artist details and their top tracks
 * @param {string} artistId - Spotify artist ID
 * @param {string} market - Country code
 * @returns {Promise<Object>} Artist object with top tracks
 */
export const fetchArtistWithTopTracks = async (artistId, market = "US") => {
  try {
    const [artist, topTracks] = await Promise.all([
      spotifyAPI.getArtist(artistId),
      spotifyAPI.getArtistTopTracks(artistId, market),
    ]);

    const transformedArtist = transformArtist(artist);
    const songs = await Promise.all(
      (topTracks.tracks || []).map(async (track) => {
        const song = transformTrack(track);

        // If no preview URL, try to get YouTube fallback
        if (!song.src) {
          try {
            const youtubeResult = await searchYouTube(
              `${song.title} ${song.artist} official audio`,
            );
            if (youtubeResult.success) {
              song.src = youtubeResult.videoId;
              song.srcType = "youtube";
              song.cover = `https://img.youtube.com/vi/${youtubeResult.videoId}/mqdefault.jpg`;
            }
          } catch (youtubeError) {
            // Log error but don't fail the entire batch
            console.warn(
              `YouTube fallback failed for ${song.title}:`,
              youtubeError.message,
            );
          }
        }

        return song;
      }),
    );

    return {
      ...transformedArtist,
      topTracks: songs.filter(Boolean),
    };
  } catch (error) {
    console.error("Error fetching artist with top tracks:", error);
    return null;
  }
};

/**
 * Fetch album with tracks
 * @param {string} albumId - Spotify album ID
 * @returns {Promise<Object>} Album object with tracks
 */
export const fetchAlbumWithTracks = async (albumId) => {
  try {
    const [album, tracks] = await Promise.all([
      spotifyAPI.getAlbum(albumId),
      spotifyAPI.getAlbumTracks(albumId),
    ]);

    return {
      spotifyId: album.id,
      title: album.name,
      artist: getArtistNames(album.artists),
      artistId: album.artists?.[0]?.id,
      cover: getCoverImage(album.images),
      releaseDate: album.release_date,
      totalTracks: album.total_tracks,
      albumType: album.album_type,
      tracks: (tracks.items || []).map((track) => ({
        ...transformTrack(track),
        albumCover: getCoverImage(album.images),
      })),
    };
  } catch (error) {
    console.error("Error fetching album with tracks:", error);
    return null;
  }
};

/**
 * Fetch playlist with tracks
 * @param {string} playlistId - Spotify playlist ID
 * @returns {Promise<Object>} Playlist object with tracks
 */
export const fetchPlaylistWithTracks = async (playlistId) => {
  try {
    const playlist = await spotifyAPI.getPlaylist(playlistId);

    const songs = await Promise.all(
      (playlist.tracks?.items || []).map(async (item) => {
        if (!item.track) return null;

        const song = transformTrack(item.track);

        // If no preview URL, try to get YouTube fallback
        if (!song.src) {
          try {
            const youtubeResult = await searchYouTube(
              `${song.title} ${song.artist} official audio`,
            );
            if (youtubeResult.success) {
              song.src = youtubeResult.videoId;
              song.srcType = "youtube";
              song.cover = `https://img.youtube.com/vi/${youtubeResult.videoId}/mqdefault.jpg`;
            }
          } catch (youtubeError) {
            // Log error but don't fail the entire batch
            console.warn(
              `YouTube fallback failed for ${song.title}:`,
              youtubeError.message,
            );
          }
        }

        return song;
      }),
    );

    return {
      spotifyId: playlist.id,
      name: playlist.name,
      description: playlist.description,
      cover: getCoverImage(playlist.images),
      owner: playlist.owner?.display_name,
      totalTracks: playlist.tracks?.total,
      tracks: songs.filter(Boolean),
    };
  } catch (error) {
    console.error("Error fetching playlist with tracks:", error);
    return null;
  }
};

/**
 * Get YouTube video ID for a song (for full playback)
 * @param {string} title - Song title
 * @param {string} artist - Artist name
 * @returns {Promise<string|null>} YouTube video ID
 */
export const getYouTubeVideoId = async (title, artist) => {
  try {
    const result = await searchYouTube(`${title} ${artist} official audio`);
    return result.success ? result.videoId : null;
  } catch (error) {
    console.error("Error getting YouTube video ID:", error);
    return null;
  }
};

/**
 * Clear song cache
 */
export const clearSongCache = () => {
  songCache.clear();
};

export default {
  fetchSongsByCategory,
  fetchTrendingSongs,
  searchSongs,
  fetchArtistWithTopTracks,
  fetchAlbumWithTracks,
  fetchPlaylistWithTracks,
  getYouTubeVideoId,
  clearSongCache,
};
