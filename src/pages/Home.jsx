import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "../components/layout/Sidebar";
import NowPlayingMedia from "../components/player/NowPlayingMedia";
import { usePlayer } from "../context/PlayerContext";
import { useSpotify } from "../context/SpotifyContext";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { allSongs, artists } from "../data/allSongs";
import { transformTrack } from "../utils/spotifyHelpers";
import { searchAndCreateSong } from "../lib/youtube";
import { searchSpotify } from "../lib/spotify";
import * as songApi from "../lib/songApi";
import { normalizeSearchText } from "../utils/artistSearch";

export default function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentSong, playSong, formatTime } = usePlayer();
  const { newReleases, isConfigured } = useSpotify();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [fetchedSongs, setFetchedSongs] = useState([]);
  const [isLoadingFetched, setIsLoadingFetched] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [displayedSongs, setDisplayedSongs] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingSongIndex, setLoadingSongIndex] = useState(null);
  const [offset, setOffset] = useState(0);
  const lastSongRef = useRef(null);
  const contentRef = useRef(null);

  // Global search states
  const [searchResults, setSearchResults] = useState([]);
  const [searchedArtists, setSearchedArtists] = useState([]);
  const [searchedAlbums, setSearchedAlbums] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const MIN_SPOTIFY_SEARCH_LENGTH = 3;
  const [isDownloading, setIsDownloading] = useState(false);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const downloadStatusTimeoutRef = useRef(null);
  const previousSongRef = useRef(null);
  const queryFromUrl = searchParams.get("search") || "";
  const [artistImageOverrides, setArtistImageOverrides] = useState({});
  const [artistImageResolutionState, setArtistImageResolutionState] = useState(
    {},
  );

  const ARTIST_FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=600&q=80";
  const MEDIA_FALLBACK_IMAGE = "/Logo-icon.png";
  const ALBUM_FALLBACK_IMAGE = "/Logo-icon.png";

  const displaySong = currentSong || allSongs[0];
  const SONGS_PER_PAGE = 20;

  const resolveWikipediaArtistImage = useCallback(async (artistName) => {
    const normalizedName = (artistName || "").trim();
    if (!normalizedName) return null;

    const searchCandidates = [
      normalizedName,
      normalizedName.replace(/&/g, "and"),
      normalizedName.split(",")[0]?.trim(),
      normalizedName.split("-")[0]?.trim(),
    ].filter(Boolean);

    for (const candidate of searchCandidates) {
      try {
        const response = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate)}`,
        );
        if (!response.ok) continue;

        const data = await response.json();
        if (data?.thumbnail?.source) {
          return data.thumbnail.source;
        }
      } catch {
        continue;
      }
    }

    return null;
  }, []);

  const handleArtistImageError = useCallback(
    async (artistName) => {
      const key = artistName || "";
      if (!key) return;

      if (artistImageResolutionState[key] === "resolving") return;
      if (artistImageResolutionState[key] === "resolved") return;

      setArtistImageResolutionState((prev) => ({
        ...prev,
        [key]: "resolving",
      }));

      const wikipediaImage = await resolveWikipediaArtistImage(key);

      setArtistImageOverrides((prev) => ({
        ...prev,
        [key]: wikipediaImage || ARTIST_FALLBACK_IMAGE,
      }));

      setArtistImageResolutionState((prev) => ({
        ...prev,
        [key]: "resolved",
      }));
    },
    [artistImageResolutionState, resolveWikipediaArtistImage],
  );

  // Shuffle array function
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Fetch famous international and national songs
  const loadFamousSongs = useCallback(
    async (loadMore = false, currentOffset = 0, useRandomQuery = false) => {
      // Set loading state first
      if (!loadMore) {
        setIsLoadingFetched(true);
        setFetchError(null);
      } else {
        setLoadingMore(true);
      }

      if (!isConfigured) {
        // Use local songs if Spotify is not configured
        const localSongs = shuffleArray(allSongs).slice(0, 20);
        if (loadMore) {
          setFetchedSongs((prev) => [...prev, ...localSongs]);
          setDisplayedSongs((prev) => [...prev, ...localSongs]);
        } else {
          setFetchedSongs(localSongs);
          setDisplayedSongs(localSongs.slice(0, SONGS_PER_PAGE));
        }
        // Allow infinite scroll with local songs
        setHasMore(true);
        // Reset loading state
        if (!loadMore) {
          setIsLoadingFetched(false);
        } else {
          setLoadingMore(false);
        }
        return;
      }

      try {
        // Search queries for variety
        const queries = [
          "top hits global",
          "billboard hot 100",
          "trending worldwide",
          "viral hits",
          "popular songs 2024",
          "top bollywood hits",
          "trending indian songs",
          "punjabi hits",
        ];

        // Use random query when refreshing, otherwise use offset-based query
        let queryIndex;
        if (useRandomQuery) {
          queryIndex = Math.floor(Math.random() * queries.length);
        } else {
          queryIndex =
            Math.floor(currentOffset / SONGS_PER_PAGE) % queries.length;
        }
        const selectedQuery = queries[queryIndex];

        // Fetch songs with offset for pagination
        const results = await searchSpotify(
          selectedQuery,
          "track",
          SONGS_PER_PAGE,
          currentOffset,
        );

        const songs = (results.tracks?.items || [])
          .map(transformTrack)
          .filter(Boolean)
          .map((song) => ({
            ...song,
            source: "spotify",
            needsYouTubeFallback: !song.src || song.src === "",
          }));

        if (songs.length > 0) {
          if (loadMore) {
            setFetchedSongs((prev) => [...prev, ...songs]);
            setDisplayedSongs((prev) => [...prev, ...songs]);
          } else {
            setFetchedSongs(songs);
            setDisplayedSongs(songs);
          }
          setHasMore(songs.length === SONGS_PER_PAGE);
          setOffset(currentOffset + songs.length);
        } else {
          setHasMore(false);
        }
      } catch (err) {
        console.error("Error fetching famous songs:", err);
        if (!loadMore) {
          setFetchError("Online recommendations are unavailable right now.");
          // Fallback to local songs
          const localSongs = shuffleArray(allSongs).slice(0, 20);
          setFetchedSongs(localSongs);
          setDisplayedSongs(localSongs.slice(0, SONGS_PER_PAGE));
          setHasMore(false);
        }
      } finally {
        if (!loadMore) {
          setIsLoadingFetched(false);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [isConfigured],
  );

  // Rename for clarity
  const loadNewReleases = loadFamousSongs;

  useEffect(() => {
    loadNewReleases();
  }, [loadNewReleases]);

  // Transform new releases to songs format
  useEffect(() => {
    if (newReleases && newReleases.length > 0) {
      const songs = newReleases.map((album) => ({
        title: album.title || "Unknown Title",
        artist: album.artist || "Unknown Artist",
        cover: album.cover || "/Logo-icon.png",
        duration: album.duration || 0,
        src: album.src || "",
        source: "spotify",
        albumId: album.spotifyId,
        needsYouTubeFallback: !album.src,
      }));

      setFetchedSongs(songs);
      setDisplayedSongs(songs.slice(0, SONGS_PER_PAGE));
      setHasMore(songs.length > SONGS_PER_PAGE);
    }
  }, [newReleases]);

  // Load more songs when scrolling - using our custom hook
  const loadMoreSongs = useCallback(() => {
    if (loadingMore || !hasMore) return;
    loadFamousSongs(true, offset);
  }, [loadingMore, hasMore, offset, loadFamousSongs]);

  // Use our custom infinite scroll hook with container ref
  useInfiniteScroll(loadMoreSongs, {
    enabled: hasMore && !loadingMore && !showSearch,
    isLoading: loadingMore,
    containerRef: contentRef,
    threshold: 50,
  });

  // Handle refresh - clear and reload songs
  const handleRefresh = () => {
    // Clear the song cache first to ensure fresh data is fetched
    // This bypasses the caching issue that returns old results
    songApi.clearSongCache();

    // Reset all states first - clear displayed songs to show loading state
    setOffset(0);
    setHasMore(true);
    setDisplayedSongs([]); // Clear displayed songs to show loading
    setFetchedSongs([]); // Clear fetched songs

    // Then fetch new random songs with random query
    loadNewReleases(false, 0, true);
  };

  // Handle play with YouTube fallback
  const handlePlaySong = async (song, index) => {
    const songToPlay = displayedSongs[index];

    // If song needs YouTube fallback, fetch it first
    if (!songToPlay.src || songToPlay.src === "") {
      setLoadingSongIndex(index);
      try {
        const youtubeSong = await searchAndCreateSong(
          songToPlay.title,
          songToPlay.artist,
        );
        if (youtubeSong) {
          // Update the song with YouTube source
          const updatedSong = {
            ...songToPlay,
            src: youtubeSong.src,
            srcType: "youtube",
            source: "youtube",
            cover: youtubeSong.cover || songToPlay.cover,
            needsYouTubeFallback: false,
          };

          // Update in displayed songs
          const updatedSongs = [...displayedSongs];
          updatedSongs[index] = updatedSong;
          setDisplayedSongs(updatedSongs);

          // Play the updated song
          playSong(updatedSongs, index);
        } else {
          console.warn(
            `Could not find YouTube source for: ${songToPlay.title}`,
          );
        }
      } catch (error) {
        console.error("Error fetching YouTube fallback:", error);
      } finally {
        setLoadingSongIndex(null);
      }
    } else {
      // Song has valid source, play directly
      playSong(displayedSongs, index);
    }
  };

  // Handle search result play with YouTube fallback
  const handleSearchResultPlay = async (song, index) => {
    const songToPlay = searchResults[index];

    // If song needs YouTube fallback, fetch it first
    if (!songToPlay.src || songToPlay.src === "") {
      setLoadingSongIndex(index);
      try {
        const youtubeSong = await searchAndCreateSong(
          songToPlay.title,
          songToPlay.artist,
        );
        if (youtubeSong) {
          // Update the song with YouTube source
          const updatedSong = {
            ...songToPlay,
            src: youtubeSong.src,
            srcType: "youtube",
            source: "youtube",
            cover: youtubeSong.cover || songToPlay.cover,
            needsYouTubeFallback: false,
          };

          // Update in search results
          const updatedResults = [...searchResults];
          updatedResults[index] = updatedSong;
          setSearchResults(updatedResults);

          // Play the updated song
          playSong(updatedResults, index);
        } else {
          console.warn(
            `Could not find YouTube source for: ${songToPlay.title}`,
          );
        }
      } catch (error) {
        console.error("Error fetching YouTube fallback:", error);
      } finally {
        setLoadingSongIndex(null);
      }
    } else {
      // Song has valid source, play directly
      playSong(searchResults, index);
    }
  };

  // Use displayed songs for rendering
  const recommendedSongs = displayedSongs;

  // Search across all available songs (local + fetched)
  const performGlobalSearch = useCallback(
    (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        setSearchedArtists([]);
        setSearchedAlbums([]);
        return;
      }

      const normalizedQuery = normalizeSearchText(query);

      // Search for matching artists
      const matchedArtists = artists.filter((artist) =>
        normalizeSearchText(artist.name || "").includes(normalizedQuery),
      );
      setSearchedArtists(matchedArtists);

      // Search for matching albums from current releases
      const matchedAlbums = (newReleases || []).filter((album) =>
        [album.title, album.artist, album.releaseDate]
          .filter(Boolean)
          .some((value) =>
            normalizeSearchText(value).includes(normalizedQuery),
          ),
      );
      setSearchedAlbums(matchedAlbums);

      // Combine local songs and fetched songs for search
      const allAvailableSongs = [
        ...allSongs,
        ...fetchedSongs.filter(
          (s) =>
            !allSongs.some(
              (local) => local.title === s.title && local.artist === s.artist,
            ),
        ),
      ];

      const results = allAvailableSongs.filter(
        (song) =>
          normalizeSearchText(song.title || "").includes(normalizedQuery) ||
          normalizeSearchText(song.artist || "").includes(normalizedQuery),
      );

      setSearchResults(results);
    },
    [fetchedSongs, newReleases],
  );

  // Handle search with debounce for live search
  const handleSearchInput = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search - search local/fetched songs immediately, trigger API search after delay
    if (query.trim()) {
      // Immediate local search
      performGlobalSearch(query);

      // Debounced API search for more results
      if (query.trim().length >= MIN_SPOTIFY_SEARCH_LENGTH) {
        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
          try {
            // Search Spotify for additional results
            const spotifyResults = await searchSpotify(
              query,
              "track,album",
              10,
            );
            const apiSongs = (spotifyResults.tracks?.items || [])
              .map(transformTrack)
              .filter(Boolean)
              .map((song) => ({
                ...song,
                source: "spotify",
                needsYouTubeFallback: !song.src || song.src === "",
              }));

            const apiAlbums = (spotifyResults.albums?.items || []).map(
              (album) => ({
                spotifyId: album.id,
                title: album.name || "Unknown Album",
                artist:
                  album.artists
                    ?.map((artist) => artist?.name)
                    .filter(Boolean)
                    .join(", ") || "Unknown Artist",
                cover: album.images?.[0]?.url || "",
                releaseDate: album.release_date || "",
              }),
            );

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

            setSearchedAlbums((prev) => {
              const existingIds = new Set(
                prev.map(
                  (album) =>
                    album.spotifyId ||
                    `${album.title || ""}-${album.artist || ""}`,
                ),
              );
              const newAlbums = apiAlbums.filter((album) => {
                const albumId =
                  album.spotifyId ||
                  `${album.title || ""}-${album.artist || ""}`;
                return !existingIds.has(albumId);
              });
              return [...prev, ...newAlbums];
            });
          } catch (error) {
            console.error("Error searching Spotify:", error);
          } finally {
            setIsSearching(false);
          }
        }, 500);
      } else {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setSearchedArtists([]);
      setSearchedAlbums([]);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const query = queryFromUrl.trim();
    if (!query) return;

    setShowSearch(true);
    setSearchQuery(query);
    performGlobalSearch(query);

    if (query.length >= MIN_SPOTIFY_SEARCH_LENGTH) {
      setIsSearching(true);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const spotifyResults = await searchSpotify(query, "track,album", 10);
          const apiSongs = (spotifyResults.tracks?.items || [])
            .map(transformTrack)
            .filter(Boolean)
            .map((song) => ({
              ...song,
              source: "spotify",
              needsYouTubeFallback: !song.src || song.src === "",
            }));

          const apiAlbums = (spotifyResults.albums?.items || []).map(
            (album) => ({
              spotifyId: album.id,
              title: album.name || "Unknown Album",
              artist:
                album.artists
                  ?.map((artist) => artist?.name)
                  .filter(Boolean)
                  .join(", ") || "Unknown Artist",
              cover: album.images?.[0]?.url || "",
              releaseDate: album.release_date || "",
            }),
          );

          setSearchResults((prev) => {
            const existingIds = new Set(
              prev.map((song) => `${song.title}-${song.artist}`),
            );
            const newResults = apiSongs.filter(
              (song) => !existingIds.has(`${song.title}-${song.artist}`),
            );
            return [...prev, ...newResults];
          });

          setSearchedAlbums((prev) => {
            const existingIds = new Set(
              prev.map(
                (album) =>
                  album.spotifyId ||
                  `${album.title || ""}-${album.artist || ""}`,
              ),
            );

            const newAlbums = apiAlbums.filter((album) => {
              const albumId =
                album.spotifyId || `${album.title || ""}-${album.artist || ""}`;
              return !existingIds.has(albumId);
            });

            return [...prev, ...newAlbums];
          });
        } catch (error) {
          console.error("Error searching Spotify:", error);
        } finally {
          setIsSearching(false);
        }
      }, 500);
    }
  }, [
    MIN_SPOTIFY_SEARCH_LENGTH,
    performGlobalSearch,
    queryFromUrl,
    searchParams,
  ]);

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchQuery("");
      setSearchResults([]);
      setSearchedArtists([]);
      setSearchedAlbums([]);
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

    if (!song) {
      showDownloadStatus("No song selected to watch.");
      return;
    }

    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadStatus("");

    try {
      console.log("Home: Watch video triggered for", song.title);
      const youtubeSong = await searchAndCreateSong(song.title, song.artist);

      if (!youtubeSong) {
        showDownloadStatus("No video found for this song.");
        return;
      }

      previousSongRef.current = song;
      playSong([youtubeSong], 0);
      setIsVideoActive(true);
      showDownloadStatus("Playing video...");
    } catch (error) {
      console.error("Home: Watch video error:", error);
      showDownloadStatus(
        error instanceof Error ? error.message : "Could not play this video.",
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

  // Determine which songs to show in the list
  const songsToShow = showSearch ? searchResults : recommendedSongs;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="main-content" ref={contentRef}>
        <header className="top-nav">
          <div className="breadcrumb">Artists ~ Top 2026</div>
          <nav>
            {/* Search Icon */}
            <button
              className={`nav-link search-btn ${showSearch ? "active" : ""}`}
              onClick={toggleSearch}
            >
              <i
                className={`fa-solid ${showSearch ? "fa-xmark" : "fa-magnifying-glass"}`}
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
          <div className="search-container mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search songs, artists, or albums..."
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
                    setSearchedArtists([]);
                    setSearchedAlbums([]);
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
                Searching Spotify...
              </div>
            )}
          </div>
        )}

        {/* Popular Artists Section */}
        {!showSearch && (
          <section className="playlist-section">
            <div className="section-header" style={{ marginBottom: "15px" }}>
              <h2 style={{ color: "#fff" }}>Popular Artists</h2>
              <div
                style={{ display: "flex", gap: "12px", alignItems: "center" }}
              >
                <Link
                  to="/artists"
                  className="see-all"
                  style={{ color: "#fff" }}
                >
                  Artists
                </Link>
              </div>
            </div>
            <div className="artists-list">
              {artists.slice(0, 8).map((artist, i) => (
                <div key={i} className="artist-item">
                  <img
                    src={
                      artistImageOverrides[artist.name] ||
                      artist.image ||
                      ARTIST_FALLBACK_IMAGE
                    }
                    alt={artist.name}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      handleArtistImageError(artist.name);
                    }}
                  />
                  <span style={{ color: "#fff" }}>{artist.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommended Section Header - Outside queue for proper flex layout */}
        <div className="recommended-header">
          <div className="section-header">
            <h2>
              {showSearch ? "Search Results" : "Recommended"}{" "}
              <span style={{ fontSize: "14px", color: "#888" }}>
                ({songsToShow.length}{" "}
                {songsToShow.length === 1 ? "song" : "songs"})
              </span>
            </h2>
            {!showSearch && (
              <button
                onClick={handleRefresh}
                disabled={isLoadingFetched}
                className="see-all"
                style={{
                  background: "none",
                  border: "none",
                  cursor: isLoadingFetched ? "not-allowed" : "pointer",
                  opacity: isLoadingFetched ? 0.5 : 1,
                }}
              >
                {isLoadingFetched ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Loading...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-refresh"></i> Refresh
                  </>
                )}
              </button>
            )}
          </div>

          {/* Loading state for initial fetch */}
          {!showSearch && isLoadingFetched && (
            <div
              style={{ textAlign: "center", padding: "40px", color: "#888" }}
            >
              <i
                className="fa-solid fa-spinner fa-spin"
                style={{ fontSize: "24px", marginBottom: "10px" }}
              ></i>
              <p>Loading recommendations...</p>
            </div>
          )}

          {/* Error state */}
          {!showSearch && fetchError && !isLoadingFetched && (
            <div
              style={{ textAlign: "center", padding: "20px", color: "#ff6b6b" }}
            >
              <p>Error loading recommendations: {fetchError}</p>
              <p style={{ fontSize: "12px", color: "#888", marginTop: "5px" }}>
                Showing local songs instead
              </p>
            </div>
          )}
        </div>

        {/* Search Results - Artists Section */}
        {showSearch && searchedArtists.length > 0 && (
          <section className="playlist-section" style={{ marginTop: "20px" }}>
            <div
              className="section-header"
              style={{ marginBottom: "15px", paddingLeft: "10px" }}
            >
              <h3 style={{ color: "#fff", fontSize: "18px" }}>Artists</h3>
            </div>
            <div className="artists-list">
              {searchedArtists.map((artist, i) => (
                <Link
                  key={i}
                  to="/artists"
                  onClick={() => {
                    // User can then search for the artist on the artists page
                    setShowSearch(false);
                  }}
                  style={{ textDecoration: "none" }}
                  className="artist-item"
                >
                  <img
                    src={
                      artistImageOverrides[artist.name] ||
                      artist.image ||
                      ARTIST_FALLBACK_IMAGE
                    }
                    alt={artist.name}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      handleArtistImageError(artist.name);
                    }}
                  />
                  <span style={{ color: "#fff" }}>{artist.name}</span>
                  {artist.role && (
                    <span
                      style={{
                        color: "#888",
                        fontSize: "12px",
                        display: "block",
                        marginTop: "4px",
                      }}
                    >
                      {artist.role}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Search Results - Albums Section */}
        {showSearch && searchedAlbums.length > 0 && (
          <section className="playlist-section" style={{ marginTop: "20px" }}>
            <div
              className="section-header"
              style={{ marginBottom: "15px", paddingLeft: "10px" }}
            >
              <h3 style={{ color: "#fff", fontSize: "18px" }}>Albums</h3>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: "12px",
                padding: "0 10px",
              }}
            >
              {searchedAlbums.map((album, index) => (
                <Link
                  key={
                    album.spotifyId || `${album.title}-${album.artist}-${index}`
                  }
                  to={`/albums?search=${encodeURIComponent(album.title || "")}`}
                  onClick={() => setShowSearch(false)}
                  style={{
                    background: "rgba(0, 0, 0, 0.35)",
                    borderRadius: "12px",
                    padding: "10px",
                    textDecoration: "none",
                    display: "block",
                  }}
                >
                  <img
                    src={album.cover || ALBUM_FALLBACK_IMAGE}
                    alt={album.title}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = ALBUM_FALLBACK_IMAGE;
                    }}
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      borderRadius: "8px",
                      marginBottom: "8px",
                    }}
                  />
                  <div
                    style={{ color: "#fff", fontWeight: 600, fontSize: "14px" }}
                  >
                    {album.title}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: "12px" }}>
                    {album.artist}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setShowSearch(false);
                      navigate(
                        `/artists?search=${encodeURIComponent(album.artist || "")}`,
                      );
                    }}
                    style={{
                      marginTop: "8px",
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "9999px",
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.1)",
                      color: "#e5e7eb",
                      cursor: "pointer",
                    }}
                  >
                    Artist: {album.artist}
                  </button>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Search Results - Songs Section */}
        <div className="queue">
          {!showSearch && !isLoadingFetched && recommendedSongs.length > 0 ? (
            recommendedSongs.map((song, i) => (
              <div
                key={i}
                ref={i === recommendedSongs.length - 1 ? lastSongRef : null}
                className={`queue-item ${currentSong?.title === song.title ? "active" : ""}`}
                onClick={() => handlePlaySong(song, i)}
                style={{ cursor: "pointer" }}
              >
                <img
                  src={song.cover || MEDIA_FALLBACK_IMAGE}
                  alt={song.title}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = MEDIA_FALLBACK_IMAGE;
                  }}
                />
                <div className="qi-info">
                  <div className="title">{song.title}</div>
                  <div className="artist">{song.artist}</div>
                  {song.source === "spotify" && <div></div>}

                  {loadingSongIndex === i && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#2d30eb",
                        marginTop: "2px",
                      }}
                    >
                      <i
                        className="fa-solid fa-spinner fa-spin"
                        style={{ marginRight: "4px" }}
                      ></i>
                      Loading...
                    </div>
                  )}
                </div>
                <div className="qi-duration">{formatTime(song.duration)}</div>
              </div>
            ))
          ) : showSearch && searchResults.length > 0 ? (
            <>
              {searchedArtists.length > 0 && (
                <div
                  style={{
                    paddingLeft: "10px",
                    paddingTop: "20px",
                    borderTop: "1px solid #333",
                    marginTop: "20px",
                  }}
                >
                  <h3 style={{ color: "#fff", fontSize: "18px" }}>Songs</h3>
                </div>
              )}
              {searchResults.map((song, i) => (
                <div
                  key={i}
                  className={`queue-item ${currentSong?.title === song.title ? "active" : ""}`}
                  onClick={() => handleSearchResultPlay(song, i)}
                >
                  <img
                    src={song.cover || MEDIA_FALLBACK_IMAGE}
                    alt={song.title}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = MEDIA_FALLBACK_IMAGE;
                    }}
                  />
                  <div className="qi-info">
                    <div className="title">{song.title}</div>
                    <button
                      type="button"
                      className="artist"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(
                          `/artists?search=${encodeURIComponent(song.artist || "")}`,
                        );
                      }}
                    >
                      {song.artist}
                    </button>
                  </div>
                  <div className="qi-duration">{formatTime(song.duration)}</div>
                </div>
              ))}
            </>
          ) : (
            <div className="no-results">
              <p
                style={{
                  color: "#888",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                {showSearch
                  ? searchedArtists.length > 0 || searchedAlbums.length > 0
                    ? `No songs found for "${searchQuery}", but artists/albums match!`
                    : `No songs, artists, or albums found for "${searchQuery}"`
                  : "No recommendations available"}
              </p>
            </div>
          )}

          {/* Loading more indicator for infinite scroll */}
          {!showSearch && loadingMore && (
            <div
              style={{ textAlign: "center", padding: "20px", color: "#888" }}
            >
              <i
                className="fa-solid fa-spinner fa-spin"
                style={{ fontSize: "20px" }}
              ></i>
              <p style={{ fontSize: "12px", marginTop: "5px" }}>
                Loading more songs...
              </p>
            </div>
          )}

          {/* End of list indicator */}
          {!showSearch &&
            !hasMore &&
            recommendedSongs.length > 0 &&
            !loadingMore && (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "#666",
                }}
              >
                <p style={{ fontSize: "12px" }}>No more songs to load</p>
              </div>
            )}
        </div>
      </main>

      {/* Now Playing Sidebar */}
      <aside className="now-playing">
        <h3>Now Playing</h3>
        <NowPlayingMedia
          song={displaySong}
          fallbackImage={MEDIA_FALLBACK_IMAGE}
          showVideo={isVideoActive}
          onCloseVideo={handleCloseVideo}
          onImageError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = MEDIA_FALLBACK_IMAGE;
          }}
        />
        <div className="now-playing-info">
          <div className="track-title">{displaySong.title}</div>
          <div className="track-artist">{displaySong.artist}</div>
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
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              borderRadius: "25px",
              border: "none",
              fontWeight: "600",
              fontSize: "14px",
              transition: "opacity 0.2s, box-shadow 0.2s",
              boxShadow: isDownloading
                ? "0 2px 10px rgba(102, 126, 234, 0.3)"
                : "0 4px 15px rgba(102, 126, 234, 0.4)",
              cursor: isDownloading ? "not-allowed" : "pointer",
              opacity: isDownloading ? 0.8 : 1,
            }}
          >
            <i
              className={`fa-solid ${isDownloading ? "fa-spinner fa-spin" : videoActionIcon}`}
            ></i>
            {isDownloading ? "Loading..." : videoActionLabel}
          </button>
          {downloadStatus && (
            <p
              style={{
                marginTop: "8px",
                color: "#bfc7ff",
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
            <li>
              <h3>
                <i className="fa-solid fa-compact-disc"></i> Song Categories
              </h3>
            </li>
            <li>
              <Link to="/playlists" onClick={() => setMobileMenuOpen(false)}>
                • My playlist
              </Link>
            </li>
            <li>
              <Link to="/english" onClick={() => setMobileMenuOpen(false)}>
                • English Songs
              </Link>
            </li>
            <li>
              <Link to="/hindi" onClick={() => setMobileMenuOpen(false)}>
                • Bollywood Songs
              </Link>
            </li>
            <li>
              <Link to="/marathi" onClick={() => setMobileMenuOpen(false)}>
                • Marathi Songs
              </Link>
            </li>
            <li>
              <Link to="/about" onClick={() => setMobileMenuOpen(false)}>
                <h3>
                  <i className="fa-solid fa-circle-info"></i> About
                </h3>
              </Link>
            </li>
            <li>
              <Link to="/help" onClick={() => setMobileMenuOpen(false)}>
                <h3>
                  <i className="fa-solid fa-question"></i> Help
                </h3>
              </Link>
            </li>
            <li>
              <Link to="/account" onClick={() => setMobileMenuOpen(false)}>
                <h3>
                  <i className="fa-solid fa-users"></i> Account
                </h3>
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
