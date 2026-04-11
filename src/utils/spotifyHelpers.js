/**
 * Spotify API Response Transformers
 * Converts Spotify API responses to match the app's song format
 */

// Convert duration from milliseconds to seconds
export const msToSeconds = (ms) => Math.floor(ms / 1000);

// Format duration in mm:ss
export const formatDuration = (ms) => {
  const seconds = msToSeconds(ms);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const DEFAULT_SPOTIFY_IMAGE = "/Logo-icon.png";

const BROKEN_SPOTIFY_ARTIST_IMAGE_IDS = new Set([
  "ab6761610000e5eb217e2fd0f250f2f6e9f70906",
  "ab6761610000e5eb7645f0f8f4a9f3ca6f6f5f82",
  "ab6761610000e5eb7d44f8e6cf236503d17b4771",
  "ab6761610000e5ebca7612f0dd5db8d0a5e11ad1",
  "ab6761610000e5ebff6d6df9f8ebf1b2d6f2cc4a",
  "ab6761610000e5eb1f9cbf4f20fd74610fb9a909",
  "ab6761610000e5eb7f213f7f84f8fb080a8c8f80",
  "ab6761610000e5ebf19d2a3530d90fe3f263e4d6",
  "ab6761610000e5ebf4ee2ca8f8b7de4d35c0d17f",
  "ab6761610000e5eb9f6d537683495ea35ca2fa02",
  "ab6761610000e5ebf3cf89e3297d482ca3928b70",
  "ab6761610000e5eb983d7ddf4f2c79a59f4beadc",
  "ab6761610000e5eb3d8886758f209263dd4d3462",
  "ab6761610000e5ebd3f138a37671d57b1949e197",
  "ab6761610000e5eb042f0f6f501e0adf7eecca40",
]);

const blockedSpotifyImageCounts = new Map();
let totalBlockedSpotifyImages = 0;

const reportBlockedSpotifyImage = (imageId, originalValue) => {
  if (!import.meta.env.DEV) return;

  const key = (imageId || "unknown").toLowerCase();
  const nextCount = (blockedSpotifyImageCounts.get(key) || 0) + 1;
  blockedSpotifyImageCounts.set(key, nextCount);
  totalBlockedSpotifyImages += 1;

  if (nextCount !== 1) return;

  console.warn(
    `[Spotify image sanitizer] blocked image id=${key} totalBlocked=${totalBlockedSpotifyImages}`,
    originalValue,
  );
};

const extractSpotifyImageId = (value = "") => {
  const trimmed = value.toString().trim();
  const fromPath = trimmed.match(/ab676161[0-9a-z]+$/i)?.[0];
  return (fromPath || trimmed).toLowerCase();
};

const sanitizeSpotifyImageUrl = (url) => {
  const value = (url || "").toString().trim();
  if (!value) return DEFAULT_SPOTIFY_IMAGE;

  if (/^ab676161[0-9a-z]+$/i.test(value)) {
    reportBlockedSpotifyImage(value, value);
    return DEFAULT_SPOTIFY_IMAGE;
  }

  const imageId = extractSpotifyImageId(value);
  if (imageId && BROKEN_SPOTIFY_ARTIST_IMAGE_IDS.has(imageId)) {
    reportBlockedSpotifyImage(imageId, value);
    return DEFAULT_SPOTIFY_IMAGE;
  }

  return value;
};

// Get the best image from Spotify's image array
export const getBestImage = (images) => {
  if (!images || images.length === 0) {
    return DEFAULT_SPOTIFY_IMAGE;
  }

  // Prefer medium size (300x300), fallback to first available
  const medium = images.find((img) => img.width === 300);
  return sanitizeSpotifyImageUrl(medium?.url || images[0]?.url);
};

// Get the best image URL from Spotify images (prefer larger images for cover)
export const getCoverImage = (images) => {
  if (!images || images.length === 0) {
    return DEFAULT_SPOTIFY_IMAGE;
  }

  // Sort by size (largest first) and get the largest available
  const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sanitizeSpotifyImageUrl(sorted[0]?.url);
};

// Get artist names from Spotify artist array
export const getArtistNames = (artists) => {
  if (!artists || artists.length === 0) return "Unknown Artist";
  return artists.map((a) => a.name).join(", ");
};

// Transform Spotify track to app's song format
export const transformTrack = (track) => {
  if (!track) return null;

  const hasPreview = !!track.preview_url;

  return {
    // Spotify-specific IDs
    spotifyId: track.id,
    spotifyUri: track.uri,

    // Basic info
    title: track.name || "Unknown Title",
    artist: getArtistNames(track.artists),
    artistId: track.artists?.[0]?.id || null,

    // Audio
    src: track.preview_url || "", // 30-second preview URL
    srcType: hasPreview ? "spotify" : "", // Track the source type

    // Cover image
    cover: getCoverImage(track.album?.images),

    // Metadata
    lyrics: "Lyrics not available",
    duration: msToSeconds(track.duration_ms),

    // Additional info
    album: track.album?.name || "Unknown Album",
    albumId: track.album?.id || null,
    releaseDate: track.album?.release_date,
    popularity: track.popularity,
    trackNumber: track.track_number,
    discNumber: track.disc_number,
    explicit: track.explicit,

    // Source
    source: "spotify",

    // YouTube fallback flag - true if no Spotify preview URL available
    needsYouTubeFallback: !hasPreview,
  };
};

// Transform Spotify artist to app's artist format
export const transformArtist = (artist) => {
  if (!artist) return null;

  return {
    // Spotify-specific IDs
    spotifyId: artist.id,
    spotifyUri: artist.uri,

    // Basic info
    name: artist.name || "Unknown Artist",

    // Image
    image: getBestImage(artist.images),

    // Metadata
    genres: artist.genres || [],
    popularity: artist.popularity,
    followers: artist.followers?.total || 0,

    // Source
    source: "spotify",
  };
};

// Transform Spotify album to app's album format
export const transformAlbum = (album) => {
  if (!album) return null;

  return {
    // Spotify-specific IDs
    spotifyId: album.id,
    spotifyUri: album.uri,

    // Basic info
    title: album.name || "Unknown Album",
    artist: getArtistNames(album.artists),
    artistId: album.artists?.[0]?.id || null,

    // Cover image
    cover: getCoverImage(album.images),

    // Metadata
    releaseDate: album.release_date,
    totalTracks: album.total_tracks,
    albumType: album.album_type,
    genres: album.genres || [],
    popularity: album.popularity,

    // Source
    source: "spotify",
  };
};

// Transform Spotify playlist to app's playlist format
export const transformPlaylist = (playlist) => {
  if (!playlist) return null;

  return {
    // Spotify-specific IDs
    spotifyId: playlist.id,
    spotifyUri: playlist.uri,

    // Basic info
    name: playlist.name || "Unknown Playlist",
    description: playlist.description || "",

    // Cover image
    cover: getCoverImage(playlist.images),

    // Metadata
    owner: playlist.owner?.display_name || playlist.owner?.id || "Unknown",
    totalTracks: playlist.tracks?.total || 0,
    isPublic: playlist.public,
    collaborative: playlist.collaborative,

    // Source
    source: "spotify",
  };
};

// Transform Spotify playlist track item to app's song format
export const transformPlaylistTrack = (item) => {
  // Handle both "track" property (for full track objects) and direct track
  const track = item.track || item;
  return transformTrack(track);
};

// Transform multiple tracks
export const transformTracks = (tracks) => {
  if (!tracks) return [];
  return tracks.map(transformTrack).filter(Boolean);
};

// Transform multiple artists
export const transformArtists = (artists) => {
  if (!artists) return [];
  return artists.map(transformArtist).filter(Boolean);
};

// Transform multiple albums
export const transformAlbums = (albums) => {
  if (!albums) return [];
  return albums.map(transformAlbum).filter(Boolean);
};

// Transform multiple playlists
export const transformPlaylists = (playlists) => {
  if (!playlists) return [];
  return playlists.map(transformPlaylist).filter(Boolean);
};

// Create a song object compatible with the app from any source
export const createSongObject = (song) => {
  // If already in correct format, return as-is
  if (song.title && song.artist && song.src !== undefined) {
    return song;
  }

  // If Spotify track
  if (song.spotifyId || song.source === "spotify") {
    return transformTrack(song);
  }

  // Fallback
  return {
    title: song.title || "Unknown Title",
    artist: song.artist || "Unknown Artist",
    src: song.src || song.preview_url || "",
    cover: song.cover || song.image || "/Logo-icon.png",
    lyrics: song.lyrics || "Lyrics not available",
    duration: song.duration || 0,
    source: song.source || "local",
  };
};

// Check if a song has a playable source
export const hasPlayableSource = (song) => {
  if (!song) return false;

  // Has direct audio source (Spotify preview or other)
  const hasDirectSource = !!(
    song.src &&
    (song.src.startsWith("http") || song.src.startsWith("blob:"))
  );

  // Can use YouTube as fallback - check multiple conditions
  const canUseYouTubeFallback =
    song.needsYouTubeFallback === true ||
    song.srcType === "youtube" ||
    song.source === "youtube" ||
    (song.source === "spotify" && (!song.src || song.src === ""));

  return hasDirectSource || canUseYouTubeFallback;
};

// Filter songs that have playable sources
export const filterPlayableSongs = (songs) => {
  return songs.filter(hasPlayableSource);
};

export default {
  msToSeconds,
  formatDuration,
  getBestImage,
  getCoverImage,
  getArtistNames,
  transformTrack,
  transformArtist,
  transformAlbum,
  transformPlaylist,
  transformPlaylistTrack,
  transformTracks,
  transformArtists,
  transformAlbums,
  transformPlaylists,
  createSongObject,
  hasPlayableSource,
  filterPlayableSongs,
};
