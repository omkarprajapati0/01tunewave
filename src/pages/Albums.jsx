import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSpotify } from "../context/SpotifyContext";
import { usePlayer } from "../context/PlayerContext";
import { searchAndCreateSong } from "../lib/youtube";
import { searchYouTube, getYouTubeThumbnail } from "../lib/youtube";
import Sidebar from "../components/layout/Sidebar";

export default function Albums() {
  const [searchParams] = useSearchParams();
  const albumSearchInputRef = useRef(null);
  const didInitialFetchRef = useRef(false);
  const albumsGridRef = useRef(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumTracks, setAlbumTracks] = useState([]);
  const [albumSearchQuery, setAlbumSearchQuery] = useState("");
  const [trackSearchQuery, setTrackSearchQuery] = useState("");
  const [albumSortBy, setAlbumSortBy] = useState("latest");
  const [trackSortBy, setTrackSortBy] = useState("default");
  const [isTracksLoading, setIsTracksLoading] = useState(false);
  const [isRefreshingAlbums, setIsRefreshingAlbums] = useState(false);
  const [loadingTrackIndex, setLoadingTrackIndex] = useState(null);
  const [trackActionError, setTrackActionError] = useState("");
  const [youtubeFetchedAlbums, setYoutubeFetchedAlbums] = useState([]);
  const [youtubeAlbumTracksById, setYoutubeAlbumTracksById] = useState({});
  const [isFetchingAlbumFromYouTube, setIsFetchingAlbumFromYouTube] =
    useState(false);
  const {
    isConfigured,
    isLoading,
    error,
    newReleases,
    fetchNewReleases,
    fetchAlbumTracks,
  } = useSpotify();
  const { playSong, currentSong, formatTime } = usePlayer();
  const queryFromUrl = searchParams.get("search") || "";
  const ALBUM_FALLBACK_IMAGE = "/Logo-icon.png";
  const TRACK_FETCH_TIMEOUT_MS = 12000;
  const YOUTUBE_FALLBACK_TIMEOUT_MS = 12000;

  const withTimeout = useCallback((promise, timeoutMs) => {
    return Promise.race([
      promise,
      new Promise((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  }, []);

  const normalizeText = (value = "") =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const formatQueryLabel = (value = "") =>
    value
      .trim()
      .split(/\s+/)
      .map((word) =>
        word.length > 1
          ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`
          : word.toUpperCase(),
      )
      .join(" ");

  const formatDisplayText = useCallback((value = "") => {
    return value
      .replace(/\s+/g, " ")
      .replace(/\s*,\s*/g, ", ")
      .trim();
  }, []);

  const formatArtistDisplay = useCallback(
    (value = "") => {
      const normalized = formatDisplayText(value);
      if (!normalized) return "Unknown Artist";

      const uniqueArtists = Array.from(
        new Set(
          normalized
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
        ),
      );

      if (uniqueArtists.length <= 2) {
        return uniqueArtists.join(", ");
      }

      return `${uniqueArtists.slice(0, 2).join(", ")} +${uniqueArtists.length - 2}`;
    },
    [formatDisplayText],
  );

  const getAlbumIdentity = useCallback(
    (album) =>
      album?.spotifyId ||
      album?.albumId ||
      `${normalizeText(album?.title || "")}-${normalizeText(album?.artist || "")}`,
    [],
  );

  useEffect(() => {
    if (!isConfigured || didInitialFetchRef.current) return;
    didInitialFetchRef.current = true;
    fetchNewReleases();
  }, [isConfigured, fetchNewReleases]);

  useEffect(() => {
    setAlbumSearchQuery(queryFromUrl);
    if (queryFromUrl) {
      requestAnimationFrame(() => {
        albumSearchInputRef.current?.focus();
      });
    }
  }, [queryFromUrl]);

  const handleSelectAlbum = async (album) => {
    if (!album) return;

    const albumIdentity = getAlbumIdentity(album);

    setSelectedAlbum(album);
    setTrackSearchQuery("");
    setTrackSortBy("default");
    setTrackActionError("");
    setLoadingTrackIndex(null);

    if (!album.spotifyId) {
      setAlbumTracks(youtubeAlbumTracksById[albumIdentity] || []);
      return;
    }

    setIsTracksLoading(true);

    try {
      const tracks = await withTimeout(
        fetchAlbumTracks(album.spotifyId),
        TRACK_FETCH_TIMEOUT_MS,
      );

      if (!Array.isArray(tracks)) {
        setAlbumTracks([]);
        setTrackActionError(
          "Could not load songs right now. Please try Refresh or select album again.",
        );
        return;
      }

      setAlbumTracks(tracks);
    } finally {
      setIsTracksLoading(false);
    }
  };

  const handlePlayTrack = async (
    track,
    index,
    queueOverride = null,
    queueTrackIndex = 0,
  ) => {
    if (!albumTracks || albumTracks.length === 0) return;
    setTrackActionError("");

    const activeQueue = queueOverride || albumTracks;
    const activeQueueIndex = queueOverride ? queueTrackIndex : index;

    const hasSpotifyPreview = track?.src && track.src.startsWith("http");
    const hasDirectYouTubeSource =
      track?.srcType === "youtube" || track?.source === "youtube";
    if (hasSpotifyPreview || hasDirectYouTubeSource) {
      playSong(activeQueue, activeQueueIndex);
      return;
    }

    setLoadingTrackIndex(index);
    try {
      const youtubeSong = await withTimeout(
        searchAndCreateSong(track.title, track.artist),
        YOUTUBE_FALLBACK_TIMEOUT_MS,
      );
      if (!youtubeSong) {
        setTrackActionError(
          "Could not load this track right now. Try another one.",
        );
        return;
      }

      const updatedTrack = {
        ...track,
        src: youtubeSong.src,
        srcType: "youtube",
        source: "youtube",
        cover: youtubeSong.cover || track.cover,
        needsYouTubeFallback: false,
      };

      const updatedTracks = [...albumTracks];
      updatedTracks[index] = updatedTrack;
      setAlbumTracks(updatedTracks);

      if (queueOverride) {
        const updatedQueue = [...queueOverride];
        updatedQueue[queueTrackIndex] = updatedTrack;
        playSong(updatedQueue, queueTrackIndex);
      } else {
        playSong(updatedTracks, index);
      }
    } catch {
      setTrackActionError("Playback failed. Please try again.");
    } finally {
      setLoadingTrackIndex(null);
    }
  };

  const resolvePlayableTrack = useCallback(
    async (track) => {
      if (!track) return null;

      const hasSpotifyPreview = track?.src && track.src.startsWith("http");
      const hasDirectYouTubeSource =
        track?.srcType === "youtube" || track?.source === "youtube";

      if (hasSpotifyPreview || hasDirectYouTubeSource) {
        return track;
      }

      const youtubeSong = await withTimeout(
        searchAndCreateSong(track.title, track.artist),
        YOUTUBE_FALLBACK_TIMEOUT_MS,
      );

      if (!youtubeSong) return null;

      return {
        ...track,
        src: youtubeSong.src,
        srcType: "youtube",
        source: "youtube",
        cover: youtubeSong.cover || track.cover,
        needsYouTubeFallback: false,
      };
    },
    [withTimeout],
  );

  const closeAlbumDetails = useCallback((scrollToGrid = false) => {
    setSelectedAlbum(null);
    setAlbumTracks([]);
    setTrackSearchQuery("");
    setTrackSortBy("default");
    setTrackActionError("");

    if (scrollToGrid) {
      requestAnimationFrame(() => {
        albumsGridRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, []);

  const handleRefreshAlbums = async () => {
    setIsRefreshingAlbums(true);
    try {
      await fetchNewReleases();
      setSelectedAlbum(null);
      setAlbumTracks([]);
      setAlbumSortBy("latest");
      setAlbumSearchQuery("");
      setTrackSearchQuery("");
      setTrackSortBy("default");
      setTrackActionError("");
      setYoutubeFetchedAlbums([]);
      setYoutubeAlbumTracksById({});
    } finally {
      setIsRefreshingAlbums(false);
    }
  };

  const handleClearAlbumFilters = () => {
    setAlbumSearchQuery("");
    setAlbumSortBy("latest");
    setIsFetchingAlbumFromYouTube(false);
  };

  const handleClearTrackFilters = () => {
    setTrackSearchQuery("");
    setTrackSortBy("default");
  };

  useEffect(() => {
    const rawQuery = albumSearchQuery.trim();
    if (rawQuery.length < 2) {
      setIsFetchingAlbumFromYouTube(false);
      return;
    }

    const normalizedQuery = normalizeText(rawQuery);
    const hasLocalMatch = newReleases.some((album) =>
      [album.title, album.artist]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(normalizedQuery)),
    );

    const hasYoutubeMatch = youtubeFetchedAlbums.some((album) =>
      [album.title, album.artist]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(normalizedQuery)),
    );

    if (hasLocalMatch || hasYoutubeMatch) {
      setIsFetchingAlbumFromYouTube(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsFetchingAlbumFromYouTube(true);
      try {
        const result = await searchYouTube(`${rawQuery} full album audio`);
        if (!result?.success || !result.videoId) return;

        const normalizedKey = normalizeText(rawQuery).replace(/\s+/g, "-");
        const albumId = `yt-album-${normalizedKey}`;

        const alreadyAdded = youtubeFetchedAlbums.some(
          (album) => album.albumId === albumId,
        );
        if (alreadyAdded) return;

        const formattedLabel = formatQueryLabel(rawQuery);

        const youtubeAlbum = {
          albumId,
          title: formattedLabel,
          artist: "YouTube",
          cover: result.thumbnail || getYouTubeThumbnail(result.videoId),
          releaseDate: "",
          source: "youtube",
        };

        const youtubeTrack = {
          title: result.title || `${formattedLabel} (YouTube)`,
          artist: formattedLabel,
          src: result.videoId,
          srcType: "youtube",
          source: "youtube",
          cover: result.thumbnail || getYouTubeThumbnail(result.videoId),
          duration: 0,
          youtubeTitle: result.title || "YouTube result",
          needsYouTubeFallback: false,
        };

        setYoutubeFetchedAlbums((prev) => [youtubeAlbum, ...prev]);
        setYoutubeAlbumTracksById((prev) => ({
          ...prev,
          [albumId]: [youtubeTrack],
        }));
      } finally {
        setIsFetchingAlbumFromYouTube(false);
      }
    }, 550);

    return () => clearTimeout(timeoutId);
  }, [albumSearchQuery, newReleases, youtubeFetchedAlbums]);

  const mergedAlbums = useMemo(() => {
    const merged = [...youtubeFetchedAlbums, ...newReleases];
    const seen = new Set();

    return merged.filter((album) => {
      const id = getAlbumIdentity(album);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [youtubeFetchedAlbums, newReleases, getAlbumIdentity]);

  const normalizedAlbumQuery = albumSearchQuery.trim().toLowerCase();
  const filteredAlbums = mergedAlbums.filter((album) => {
    if (!normalizedAlbumQuery) return true;
    return [album.title, album.artist, album.releaseDate]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedAlbumQuery));
  });

  const sortedFilteredAlbums = useMemo(() => {
    const albums = [...filteredAlbums];
    const getTimestamp = (dateValue) => new Date(dateValue || 0).getTime() || 0;

    switch (albumSortBy) {
      case "oldest":
        return albums.sort(
          (a, b) => getTimestamp(a.releaseDate) - getTimestamp(b.releaseDate),
        );
      case "title":
        return albums.sort((a, b) =>
          (a.title || "").localeCompare(b.title || "", undefined, {
            sensitivity: "base",
          }),
        );
      case "artist":
        return albums.sort((a, b) =>
          (a.artist || "").localeCompare(b.artist || "", undefined, {
            sensitivity: "base",
          }),
        );
      case "latest":
      default:
        return albums.sort(
          (a, b) => getTimestamp(b.releaseDate) - getTimestamp(a.releaseDate),
        );
    }
  }, [albumSortBy, filteredAlbums]);

  const normalizedTrackQuery = trackSearchQuery.trim().toLowerCase();
  const filteredAlbumTracks = albumTracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => {
      if (!normalizedTrackQuery) return true;
      return [track.title, track.artist]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedTrackQuery));
    });

  const sortedFilteredAlbumTracks = useMemo(() => {
    const tracks = [...filteredAlbumTracks];

    switch (trackSortBy) {
      case "title":
        return tracks.sort((a, b) =>
          (a.track.title || "").localeCompare(b.track.title || "", undefined, {
            sensitivity: "base",
          }),
        );
      case "artist":
        return tracks.sort((a, b) =>
          (a.track.artist || "").localeCompare(
            b.track.artist || "",
            undefined,
            {
              sensitivity: "base",
            },
          ),
        );
      case "duration":
        return tracks.sort(
          (a, b) => (a.track.duration || 0) - (b.track.duration || 0),
        );
      case "default":
      default:
        return tracks;
    }
  }, [filteredAlbumTracks, trackSortBy]);

  const handlePlayAllTracks = async () => {
    if (sortedFilteredAlbumTracks.length === 0 || isTracksLoading) return;

    setTrackActionError("");
    const queue = sortedFilteredAlbumTracks.map((entry) => entry.track);

    for (let i = 0; i < sortedFilteredAlbumTracks.length; i += 1) {
      const entry = sortedFilteredAlbumTracks[i];
      setLoadingTrackIndex(entry.index);

      const playableTrack = await resolvePlayableTrack(entry.track);
      if (!playableTrack) continue;

      const updatedQueue = [...queue];
      updatedQueue[i] = playableTrack;

      const updatedTracks = [...albumTracks];
      updatedTracks[entry.index] = playableTrack;
      setAlbumTracks(updatedTracks);

      playSong(updatedQueue, i);
      setLoadingTrackIndex(null);
      return;
    }

    setLoadingTrackIndex(null);
    setTrackActionError("Could not load playable songs for this album.");
  };

  const handleShuffleTracks = async () => {
    if (sortedFilteredAlbumTracks.length === 0 || isTracksLoading) return;

    setTrackActionError("");
    const queue = sortedFilteredAlbumTracks.map((entry) => entry.track);

    const shuffledCandidates = [...sortedFilteredAlbumTracks]
      .map((entry, queueIndex) => ({ ...entry, queueIndex }))
      .sort(() => Math.random() - 0.5);

    for (const candidate of shuffledCandidates) {
      setLoadingTrackIndex(candidate.index);

      const playableTrack = await resolvePlayableTrack(candidate.track);
      if (!playableTrack) continue;

      const updatedQueue = [...queue];
      updatedQueue[candidate.queueIndex] = playableTrack;

      const updatedTracks = [...albumTracks];
      updatedTracks[candidate.index] = playableTrack;
      setAlbumTracks(updatedTracks);

      playSong(updatedQueue, candidate.queueIndex);
      setLoadingTrackIndex(null);
      return;
    }

    setLoadingTrackIndex(null);
    setTrackActionError("Could not load playable songs for this album.");
  };

  if (!isConfigured) {
    return (
      <div className="standalone-page-shell">
        <div className="standalone-page-panel max-w-4xl">
          <h1 className="standalone-page-title">Albums</h1>
          <p className="standalone-page-subtitle mb-6">
            Browse new releases and album tracks once Spotify is configured.
          </p>
          <div className="p-6 bg-gray-800/70 rounded-lg border border-white/10 text-yellow-300">
            Spotify is not configured. Add credentials to load albums.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container albums-page">
      <Sidebar />
      <div className="main-content">
        <div className="albums-content-wrap">
          <div className="max-w-6xl mx-auto albums-shell">
            <div className="mb-4 p-4 rounded-2xl border border-white/10 bg-black/25">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <div>
                  <h1 className="text-3xl font-bold">Albums</h1>
                  <p className="text-sm text-gray-400 mt-1">
                    {sortedFilteredAlbums.length} album
                    {sortedFilteredAlbums.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full md:w-auto">
                  <input
                    ref={albumSearchInputRef}
                    type="text"
                    value={albumSearchQuery}
                    onChange={(event) =>
                      setAlbumSearchQuery(event.target.value)
                    }
                    placeholder="Search albums..."
                    className="col-span-2 sm:col-span-3 lg:col-span-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                  />
                  <select
                    value={albumSortBy}
                    onChange={(event) => setAlbumSortBy(event.target.value)}
                    className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-green-500"
                  >
                    <option value="latest">Latest</option>
                    <option value="oldest">Oldest</option>
                    <option value="title">Title</option>
                    <option value="artist">Artist</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleClearAlbumFilters}
                    className="px-3 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshAlbums}
                    disabled={isLoading || isRefreshingAlbums}
                    className="px-3 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRefreshingAlbums ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>
            </div>

            {isFetchingAlbumFromYouTube && (
              <p className="text-xs text-yellow-300 mb-3">
                Searching YouTube for album...
              </p>
            )}

            {error && (
              <div className="mb-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
                {error}
              </div>
            )}

            {isLoading && newReleases.length === 0 ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : !selectedAlbum ? (
              <>
                <div className="albums-grid-scroll">
                  <div
                    ref={albumsGridRef}
                    className="albums-grid grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
                  >
                    {sortedFilteredAlbums.map((album) => (
                      <button
                        key={getAlbumIdentity(album)}
                        type="button"
                        onClick={() => handleSelectAlbum(album)}
                        className="p-3 rounded-xl text-left transition-all bg-gray-800 hover:bg-gray-700 border border-white/5 hover:border-white/15"
                      >
                        <img
                          src={album.cover || ALBUM_FALLBACK_IMAGE}
                          alt={album.title}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = ALBUM_FALLBACK_IMAGE;
                          }}
                          className="w-full aspect-square object-cover rounded-lg mb-3"
                        />
                        <p className="font-medium truncate">
                          {formatDisplayText(album.title)}
                        </p>
                        <p className="text-gray-400 text-sm truncate">
                          {formatArtistDisplay(album.artist)}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          {album.releaseDate?.split("-")[0] || "—"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {sortedFilteredAlbums.length === 0 && !isLoading && (
                  <div className="mt-4 p-4 bg-gray-800/80 border border-white/10 rounded-lg text-gray-300 flex items-center justify-between gap-2">
                    <span>No albums match your filters.</span>
                    <button
                      type="button"
                      onClick={handleClearAlbumFilters}
                      className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="albums-detail-panel">
                <div className="albums-detail-header mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={selectedAlbum.cover || ALBUM_FALLBACK_IMAGE}
                      alt={selectedAlbum.title}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = ALBUM_FALLBACK_IMAGE;
                      }}
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <h2 className="text-2xl font-bold truncate">
                        {formatDisplayText(selectedAlbum.title)} • Songs
                      </h2>
                      <p className="text-sm text-gray-400 mt-1 truncate">
                        {formatArtistDisplay(selectedAlbum.artist)} • Showing{" "}
                        {sortedFilteredAlbumTracks.length} of{" "}
                        {albumTracks.length}
                      </p>
                    </div>
                  </div>
                  <div className="albums-detail-actions">
                    <input
                      type="text"
                      value={trackSearchQuery}
                      onChange={(event) =>
                        setTrackSearchQuery(event.target.value)
                      }
                      placeholder="Search songs..."
                      className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                    />
                    <select
                      value={trackSortBy}
                      onChange={(event) => setTrackSortBy(event.target.value)}
                      className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-green-500"
                    >
                      <option value="default">Default</option>
                      <option value="title">Title</option>
                      <option value="artist">Artist</option>
                      <option value="duration">Duration</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleClearTrackFilters}
                      className="px-3 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handlePlayAllTracks}
                      disabled={
                        isTracksLoading ||
                        sortedFilteredAlbumTracks.length === 0
                      }
                      className="px-3 py-2 text-sm rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      Play All
                    </button>
                    <button
                      type="button"
                      onClick={handleShuffleTracks}
                      disabled={
                        isTracksLoading ||
                        sortedFilteredAlbumTracks.length === 0
                      }
                      className="px-3 py-2 text-sm rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      Shuffle
                    </button>
                    <button
                      type="button"
                      onClick={() => closeAlbumDetails(false)}
                      className="px-3 py-2 text-sm rounded-lg bg-rose-700 hover:bg-rose-600 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => closeAlbumDetails(true)}
                      className="px-3 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                      Back to Albums
                    </button>
                  </div>
                </div>

                {trackActionError && (
                  <div className="mb-3 p-3 rounded-lg bg-red-900/40 border border-red-500 text-red-200 text-sm">
                    {trackActionError}
                  </div>
                )}

                {isTracksLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
                  </div>
                ) : albumTracks.length > 0 ? (
                  <div className="space-y-2 albums-song-list-scroll">
                    {sortedFilteredAlbumTracks.map(
                      ({ track, index }, filteredIndex) => {
                        const isCurrentTrack =
                          currentSong?.spotifyId === track.spotifyId ||
                          (currentSong?.title === track.title &&
                            currentSong?.artist === track.artist);

                        return (
                          <button
                            key={track.spotifyId || `${track.title}-${index}`}
                            type="button"
                            onClick={() => {
                              if (
                                !normalizedTrackQuery &&
                                trackSortBy === "default"
                              ) {
                                handlePlayTrack(track, index);
                                return;
                              }

                              const queue = sortedFilteredAlbumTracks.map(
                                (entry) => entry.track,
                              );
                              handlePlayTrack(
                                track,
                                index,
                                queue,
                                filteredIndex,
                              );
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                              isCurrentTrack
                                ? "bg-green-700/60"
                                : "bg-gray-800 hover:bg-gray-700"
                            } cursor-pointer`}
                          >
                            <div className="text-left overflow-hidden">
                              <p className="font-medium truncate">
                                {formatDisplayText(track.title)}
                              </p>
                              <p className="text-sm text-gray-400 truncate">
                                {formatArtistDisplay(track.artist)}
                              </p>
                              {loadingTrackIndex === index && (
                                <p className="text-xs text-blue-300 mt-1">
                                  <i className="fa-solid fa-spinner fa-spin mr-1"></i>
                                  Loading YouTube source...
                                </p>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 whitespace-nowrap ml-4">
                              {track.duration
                                ? formatTime(track.duration)
                                : "--:--"}
                            </div>
                          </button>
                        );
                      },
                    )}

                    {sortedFilteredAlbumTracks.length === 0 && (
                      <div className="p-4 bg-gray-800 rounded-lg text-gray-300">
                        No songs match your search.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-800 rounded-lg text-gray-300">
                    No songs available for this album.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mobile-sidebar"></div>
    </div>
  );
}
