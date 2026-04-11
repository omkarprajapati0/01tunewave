import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { artists, allSongs as seedSongs } from "../data/allSongs";
import { useSongs } from "../context/SongContext";
import { usePlayer } from "../context/PlayerContext";
import {
  songHasArtistFuzzy as songHasArtist,
  splitArtistCredits,
  normalizeSearchText,
} from "../utils/artistSearch";
import {
  searchYouTube,
  getYouTubeThumbnail,
  searchAndCreateSong,
} from "../lib/youtube";
import * as spotifyAPI from "../lib/spotify";
import { transformTrack } from "../utils/spotifyHelpers";
import Sidebar from "../components/layout/Sidebar";

export default function Artists() {
  const [searchParams] = useSearchParams();
  const artistSearchInputRef = useRef(null);
  const autoSelectedQueryRef = useRef("");
  const { allSongs } = useSongs();
  const { playSong, currentSong, formatTime } = usePlayer();
  const [artistImageOverrides, setArtistImageOverrides] = useState({});
  const [artistImageResolutionState, setArtistImageResolutionState] = useState(
    {},
  );
  const [youtubeFetchedArtists, setYoutubeFetchedArtists] = useState([]);
  const [youtubeArtistSongsByName, setYoutubeArtistSongsByName] = useState({});
  const [isFetchingArtistFromYouTube, setIsFetchingArtistFromYouTube] =
    useState(false);
  const [isEnrichingSelectedArtistSongs, setIsEnrichingSelectedArtistSongs] =
    useState(false);
  const [, setArtistSongsEnrichmentState] = useState({});
  const artistSongsEnrichmentStateRef = useRef({});
  const [artistQuery, setArtistQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");

  // Pagination state for artist grid
  const [displayedArtists, setDisplayedArtists] = useState([]);
  const [artistOffset, setArtistOffset] = useState(0);
  const [artistHasMore, setArtistHasMore] = useState(true);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);

  // Pagination state for selected artist songs
  const [displayedArtistSongs, setDisplayedArtistSongs] = useState([]);
  const [songOffset, setSongOffset] = useState(0);
  const [songHasMore, setSongHasMore] = useState(true);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  const [loadingArtistSongIndex, setLoadingArtistSongIndex] = useState(null);
  const [isFetchingArtistSpotifySongs, setIsFetchingArtistSpotifySongs] =
    useState(false);

  const getSongDedupeKey = useCallback((song) => {
    const srcKey = (song?.src || "").toString().trim();
    if (srcKey) return srcKey;

    const titleKey = normalizeSearchText(song?.title || "");
    const artistKey = normalizeSearchText(song?.artist || "");
    const fallbackKey = `${titleKey}|${artistKey}`;
    return fallbackKey === "|" ? "" : fallbackKey;
  }, []);

  const ARTISTS_PER_PAGE = 12;
  const SONGS_PER_PAGE = 10;
  const MIN_SONGS_PER_SELECTED_ARTIST = 10;
  const ARTIST_ENRICHMENT_TIMEOUT_MS = 7000;
  const queryFromUrl = searchParams.get("search") || "";
  const effectiveSongs = allSongs?.length ? allSongs : seedSongs;
  const GENERIC_ARTIST_FALLBACK_IMAGE =
    "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=600&q=80";
  const INTERNATIONAL_ARTIST_NAMES = useMemo(
    () =>
      new Set([
        "Adele",
        "Beyoncé",
        "Justin Bieber",
        "Rihanna",
        "Lady Gaga",
        "Dua Lipa",
        "The Weeknd",
        "Drake",
        "Eminem",
        "Sia",
        "Charlie Puth",
        "Shawn Mendes",
        "Camila Cabello",
        "Billie Eilish",
        "Selena Gomez",
        "Coldplay",
        "Ed Sheeran",
        "Måneskin",
        "Taylor Swift",
      ]),
    [],
  );

  const getArtistRegion = useCallback(
    (artistName) =>
      INTERNATIONAL_ARTIST_NAMES.has(artistName) ? "international" : "indian",
    [INTERNATIONAL_ARTIST_NAMES],
  );

  const formatArtistName = useCallback((value) => {
    return (value || "")
      .trim()
      .split(/\s+/)
      .map((word) =>
        word.length > 1
          ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`
          : word.toUpperCase(),
      )
      .join(" ");
  }, []);

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
        [key]: wikipediaImage || GENERIC_ARTIST_FALLBACK_IMAGE,
      }));

      setArtistImageResolutionState((prev) => ({
        ...prev,
        [key]: "resolved",
      }));
    },
    [
      artistImageResolutionState,
      resolveWikipediaArtistImage,
      GENERIC_ARTIST_FALLBACK_IMAGE,
    ],
  );

  useEffect(() => {
    setArtistQuery(queryFromUrl);

    if (queryFromUrl) {
      setSelectedArtist(null);
      requestAnimationFrame(() => {
        artistSearchInputRef.current?.focus();
      });
    }
  }, [queryFromUrl]);

  const derivedArtistsFromSongs = useMemo(() => {
    const artistMap = new Map();

    effectiveSongs.forEach((song) => {
      const names = splitArtistCredits(song.artist || "");
      const fallbackNames = names.length ? names : [song.artist || ""];

      fallbackNames.forEach((name) => {
        if (!name) return;
        const normalizedName = normalizeSearchText(name);
        if (!normalizedName || artistMap.has(normalizedName)) return;

        artistMap.set(normalizedName, {
          name,
          image: song.cover || "/Logo-icon.png",
          role: "Artist",
        });
      });
    });

    return Array.from(artistMap.values()).sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  }, [effectiveSongs]);

  const artistCatalog = useMemo(() => {
    if (Array.isArray(artists) && artists.length > 0) {
      return artists;
    }
    return derivedArtistsFromSongs;
  }, [derivedArtistsFromSongs]);

  // Calculate song count for each artist (using fuzzy match)
  const artistsWithCounts = useMemo(() => {
    return artistCatalog.map((artist) => ({
      ...artist,
      region: getArtistRegion(artist.name),
      songCount: effectiveSongs.filter((song) =>
        songHasArtist(song.artist || "", artist.name || ""),
      ).length,
    }));
  }, [effectiveSongs, artistCatalog, getArtistRegion]);

  const mergedArtistsWithCounts = useMemo(() => {
    const map = new Map();

    [...artistsWithCounts, ...youtubeFetchedArtists].forEach((artist) => {
      const normalizedName = normalizeSearchText(artist.name || "");
      if (!normalizedName || map.has(normalizedName)) return;
      map.set(normalizedName, artist);
    });

    return Array.from(map.values());
  }, [artistsWithCounts, youtubeFetchedArtists]);

  // Get unique roles for filter
  const uniqueRoles = useMemo(() => {
    const roles = new Set(
      mergedArtistsWithCounts.map((artist) => artist.role || "Artist"),
    );
    return Array.from(roles).sort();
  }, [mergedArtistsWithCounts]);

  // Filter and sort artists
  const filteredAndSortedArtists = useMemo(() => {
    const normalizedQuery = normalizeSearchText(artistQuery);
    let list = mergedArtistsWithCounts.filter((artist) => {
      const matchesQuery =
        !normalizedQuery ||
        normalizeSearchText(artist.name || "").includes(normalizedQuery);
      const matchesRole = roleFilter === "all" || artist.role === roleFilter;
      const matchesRegion =
        regionFilter === "all" || artist.region === regionFilter;
      return matchesQuery && matchesRole && matchesRegion;
    });

    // Sort logic
    if (sortBy === "z-a") {
      list.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    } else if (sortBy === "songs-asc") {
      list.sort((a, b) => a.songCount - b.songCount);
    } else if (sortBy === "songs-desc") {
      list.sort((a, b) => b.songCount - a.songCount);
    } else {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return list;
  }, [artistQuery, sortBy, roleFilter, regionFilter, mergedArtistsWithCounts]);

  useEffect(() => {
    const rawQuery = queryFromUrl.trim();
    if (!rawQuery) {
      autoSelectedQueryRef.current = "";
      return;
    }

    const normalizedQuery = normalizeSearchText(rawQuery);
    if (!normalizedQuery) return;
    if (autoSelectedQueryRef.current === normalizedQuery) return;

    const exactMatch = mergedArtistsWithCounts.find(
      (artist) => normalizeSearchText(artist.name || "") === normalizedQuery,
    );
    const partialMatch = mergedArtistsWithCounts.find((artist) =>
      normalizeSearchText(artist.name || "").includes(normalizedQuery),
    );

    const bestMatch = exactMatch || partialMatch;
    if (!bestMatch) return;

    autoSelectedQueryRef.current = normalizedQuery;
    setSelectedArtist(bestMatch);
    setSongOffset(0);
    setSongHasMore(true);
  }, [queryFromUrl, mergedArtistsWithCounts]);

  useEffect(() => {
    const rawQuery = artistQuery.trim();
    if (rawQuery.length < 2) {
      setIsFetchingArtistFromYouTube(false);
      return;
    }

    const normalizedQuery = normalizeSearchText(rawQuery);
    const hasLocalMatch = artistsWithCounts.some((artist) =>
      normalizeSearchText(artist.name || "").includes(normalizedQuery),
    );
    const hasFetchedMatch = youtubeFetchedArtists.some(
      (artist) => normalizeSearchText(artist.name || "") === normalizedQuery,
    );

    if (hasLocalMatch || hasFetchedMatch) {
      setIsFetchingArtistFromYouTube(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsFetchingArtistFromYouTube(true);
      try {
        const result = await searchYouTube(`${rawQuery} official songs`);
        if (!result?.success || !result.videoId) return;

        const artistName = formatArtistName(rawQuery);
        const normalizedArtistName = normalizeSearchText(artistName);

        setYoutubeFetchedArtists((prev) => {
          if (
            prev.some(
              (artist) =>
                normalizeSearchText(artist.name || "") === normalizedArtistName,
            )
          ) {
            return prev;
          }

          return [
            {
              name: artistName,
              image: result.thumbnail || getYouTubeThumbnail(result.videoId),
              role: "YouTube Artist",
              region: getArtistRegion(artistName),
              songCount: 1,
              source: "youtube",
            },
            ...prev,
          ];
        });

        setYoutubeArtistSongsByName((prev) => ({
          ...prev,
          [normalizedArtistName]: [
            {
              title: result.title || `${artistName} - Top Result`,
              artist: artistName,
              src: result.videoId,
              srcType: "youtube",
              source: "youtube",
              cover: result.thumbnail || getYouTubeThumbnail(result.videoId),
              duration: 0,
              youtubeTitle: result.title || "YouTube Result",
            },
          ],
        }));
      } catch {
        return;
      } finally {
        setIsFetchingArtistFromYouTube(false);
      }
    }, 550);

    return () => clearTimeout(timeoutId);
  }, [
    artistQuery,
    artistsWithCounts,
    formatArtistName,
    getArtistRegion,
    youtubeFetchedArtists,
  ]);

  // Load more artists for infinite scroll
  const loadArtistsForDisplay = useCallback(() => {
    if (isLoadingArtists || !artistHasMore || selectedArtist) return;

    setIsLoadingArtists(true);

    const artistsToShow = filteredAndSortedArtists.slice(
      artistOffset,
      artistOffset + ARTISTS_PER_PAGE,
    );

    setDisplayedArtists((prev) => [...prev, ...artistsToShow]);
    const nextOffset = artistOffset + artistsToShow.length;
    setArtistOffset(nextOffset);
    setArtistHasMore(nextOffset < filteredAndSortedArtists.length);
    setIsLoadingArtists(false);
  }, [
    artistHasMore,
    artistOffset,
    filteredAndSortedArtists,
    isLoadingArtists,
    selectedArtist,
  ]);

  // Initial artist batch when filters/search change
  useEffect(() => {
    const initialArtists = filteredAndSortedArtists.slice(0, ARTISTS_PER_PAGE);
    setDisplayedArtists(initialArtists);
    setArtistOffset(initialArtists.length);
    setArtistHasMore(initialArtists.length < filteredAndSortedArtists.length);
  }, [filteredAndSortedArtists]);

  const selectedArtistAllSongs = useMemo(() => {
    if (!selectedArtist?.name) return [];

    const normalizedName = normalizeSearchText(selectedArtist.name);
    const localSongs = effectiveSongs.filter((song) =>
      songHasArtist(song.artist || "", selectedArtist.name),
    );
    const youtubeSongs = youtubeArtistSongsByName[normalizedName] || [];
    if (localSongs.length === 0) return youtubeSongs;
    if (youtubeSongs.length === 0) return localSongs;

    const mergedSongs = [];
    const seen = new Set();

    [...localSongs, ...youtubeSongs].forEach((song) => {
      const srcKey = (song?.src || "").toString().trim();
      const fallbackKey = `${normalizeSearchText(song?.title || "")}|${normalizeSearchText(song?.artist || "")}`;
      const key = srcKey || fallbackKey;
      if (!key || seen.has(key)) return;
      seen.add(key);
      mergedSongs.push(song);
    });

    return mergedSongs;
  }, [effectiveSongs, selectedArtist, youtubeArtistSongsByName]);

  const handlePlayArtistSong = useCallback(
    async (song, index) => {
      if (!song) return;

      const hasPlayableSource =
        song?.srcType === "youtube" ||
        song?.source === "youtube" ||
        (typeof song?.src === "string" &&
          (song.src.startsWith("http://") || song.src.startsWith("https://")));

      if (hasPlayableSource) {
        playSong(selectedArtistAllSongs, index);
        return;
      }

      setLoadingArtistSongIndex(index);
      try {
        const youtubeSong = await searchAndCreateSong(
          song.title,
          song.artist || selectedArtist?.name || "",
        );
        if (!youtubeSong) return;

        const updatedSong = {
          ...song,
          src: youtubeSong.src,
          srcType: "youtube",
          source: "youtube",
          cover: youtubeSong.cover || song.cover,
          duration: youtubeSong.duration || song.duration || 0,
          needsYouTubeFallback: false,
        };

        const updatedQueue = [...selectedArtistAllSongs];
        updatedQueue[index] = updatedSong;

        const normalizedName = normalizeSearchText(selectedArtist?.name || "");
        if (normalizedName) {
          setYoutubeArtistSongsByName((prev) => {
            const prior = prev[normalizedName] || [];
            const mergedBySrc = new Map();

            [...prior, updatedSong].forEach((entry) => {
              const key = getSongDedupeKey(entry);
              if (!key || mergedBySrc.has(key)) return;
              mergedBySrc.set(key, entry);
            });

            return {
              ...prev,
              [normalizedName]: Array.from(mergedBySrc.values()),
            };
          });
        }

        setDisplayedArtistSongs((prev) => {
          const next = [...prev];
          if (index >= 0 && index < next.length) {
            next[index] = updatedSong;
          }
          return next;
        });

        playSong(updatedQueue, index);
      } finally {
        setLoadingArtistSongIndex(null);
      }
    },
    [getSongDedupeKey, playSong, selectedArtistAllSongs, selectedArtist],
  );

  useEffect(() => {
    const artistName = selectedArtist?.name?.trim();
    if (!artistName) return;

    const normalizedName = normalizeSearchText(artistName);
    if (!normalizedName) return;

    const enrichmentStatus =
      artistSongsEnrichmentStateRef.current[normalizedName];
    const currentSongs = selectedArtistAllSongs || [];
    if (currentSongs.length >= MIN_SONGS_PER_SELECTED_ARTIST) return;
    if (enrichmentStatus === "resolving") return;
    if (enrichmentStatus === "resolved") return;

    let isCancelled = false;

    const enrichSongs = async () => {
      artistSongsEnrichmentStateRef.current = {
        ...artistSongsEnrichmentStateRef.current,
        [normalizedName]: "resolving",
      };
      setArtistSongsEnrichmentState((prev) => ({
        ...prev,
        [normalizedName]: "resolving",
      }));
      setIsEnrichingSelectedArtistSongs(true);

      try {
        const existingSongs = currentSongs;
        const existingIds = new Set(
          existingSongs.map((song) => getSongDedupeKey(song)).filter(Boolean),
        );

        const withTimeout = (promise, timeoutMs) =>
          Promise.race([
            promise,
            new Promise((resolve) => {
              setTimeout(() => resolve(null), timeoutMs);
            }),
          ]);

        const normalizedArtistQuery = artistName
          .replace(/[.]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        const queries = [
          `${normalizedArtistQuery} official song`,
          `${normalizedArtistQuery} hit song`,
          `${normalizedArtistQuery} top songs`,
          `${normalizedArtistQuery} latest song`,
          `${normalizedArtistQuery} live performance`,
          `${normalizedArtistQuery} best songs playlist`,
          `${normalizedArtistQuery} popular tracks`,
          `${normalizedArtistQuery} greatest hits`,
          `${normalizedArtistQuery} audio`,
          `${normalizedArtistQuery} music video`,
          `${normalizedArtistQuery} songs`,
          `${normalizedArtistQuery} top 10 songs`,
          `${artistName} official song`,
          `${artistName} songs`,
          `${artistName} best songs`,
        ];

        const needed = MIN_SONGS_PER_SELECTED_ARTIST - existingSongs.length;
        const collected = [];

        const uniqueQueries = Array.from(new Set(queries));
        const settledResults = await Promise.allSettled(
          uniqueQueries.map((query) =>
            withTimeout(searchYouTube(query), ARTIST_ENRICHMENT_TIMEOUT_MS),
          ),
        );

        if (!isCancelled) {
          settledResults.forEach((result) => {
            if (collected.length >= needed) return;
            if (result.status !== "fulfilled") return;

            const searchResult = result.value;
            if (!searchResult?.success || !searchResult.videoId) return;
            if (existingIds.has(searchResult.videoId)) return;

            existingIds.add(searchResult.videoId);
            collected.push({
              title: searchResult.title || `${artistName} - YouTube Track`,
              artist: artistName,
              src: searchResult.videoId,
              srcType: "youtube",
              source: "youtube",
              cover:
                searchResult.thumbnail ||
                getYouTubeThumbnail(searchResult.videoId),
              duration: 0,
              youtubeTitle: searchResult.title || "YouTube Result",
            });
          });
        }

        if (!isCancelled) {
          setIsFetchingArtistSpotifySongs(true);
          try {
            const spotifySearchResult = await withTimeout(
              spotifyAPI.searchSpotify(
                `artist:${normalizedArtistQuery}`,
                "track",
                25,
                0,
              ),
              ARTIST_ENRICHMENT_TIMEOUT_MS,
            );

            const spotifyTracks = spotifySearchResult?.tracks?.items || [];
            const spotifySongs = spotifyTracks
              .map((track) => transformTrack(track))
              .filter(Boolean)
              .filter((song) => {
                const normalizedSongArtist = normalizeSearchText(
                  song.artist || "",
                );
                return normalizedSongArtist.includes(normalizedName);
              });

            for (const spotifySong of spotifySongs) {
              if (collected.length >= needed) break;

              const dedupeKey = getSongDedupeKey(spotifySong);
              if (!dedupeKey || existingIds.has(dedupeKey)) continue;

              existingIds.add(dedupeKey);
              collected.push({
                ...spotifySong,
                artist: spotifySong.artist || artistName,
              });
            }
          } catch {
            // no-op: keep existing collected songs
          } finally {
            if (!isCancelled) {
              setIsFetchingArtistSpotifySongs(false);
            }
          }
        }

        if (isCancelled || collected.length === 0) return;

        setYoutubeArtistSongsByName((prev) => {
          const prior = prev[normalizedName] || [];
          const mergedBySrc = new Map();

          [...prior, ...collected].forEach((song) => {
            const key = getSongDedupeKey(song);
            if (!key || mergedBySrc.has(key)) return;
            mergedBySrc.set(key, song);
          });

          return {
            ...prev,
            [normalizedName]: Array.from(mergedBySrc.values()),
          };
        });
      } finally {
        if (!isCancelled) {
          setIsEnrichingSelectedArtistSongs(false);
          artistSongsEnrichmentStateRef.current = {
            ...artistSongsEnrichmentStateRef.current,
            [normalizedName]: "resolved",
          };
          setArtistSongsEnrichmentState((prev) => ({
            ...prev,
            [normalizedName]: "resolved",
          }));
        }
      }
    };

    enrichSongs();

    return () => {
      isCancelled = true;
    };
  }, [
    getSongDedupeKey,
    selectedArtist,
    selectedArtistAllSongs,
    MIN_SONGS_PER_SELECTED_ARTIST,
  ]);

  // Load songs for selected artist
  const loadArtistSongs = useCallback(
    (loadMore = false) => {
      if (isLoadingSongs) return;

      setIsLoadingSongs(true);

      const currentOffset = loadMore ? songOffset : 0;
      const songsToShow = selectedArtistAllSongs.slice(
        currentOffset,
        currentOffset + SONGS_PER_PAGE,
      );

      if (loadMore) {
        setDisplayedArtistSongs((prev) => [...prev, ...songsToShow]);
      } else {
        setDisplayedArtistSongs(songsToShow);
      }

      setSongOffset(currentOffset + songsToShow.length);
      setSongHasMore(
        currentOffset + SONGS_PER_PAGE < selectedArtistAllSongs.length,
      );
      setIsLoadingSongs(false);
    },
    [songOffset, isLoadingSongs, selectedArtistAllSongs],
  );

  // Load initial songs when artist is selected
  useEffect(() => {
    if (selectedArtist) {
      setSongOffset(0);
      setSongHasMore(true);
      setDisplayedArtistSongs([]);
      loadArtistSongs(false);
    }
  }, [selectedArtist, loadArtistSongs]);

  // Infinite scroll for artists
  const artistsObserverTarget = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          artistHasMore &&
          !isLoadingArtists &&
          !selectedArtist
        ) {
          loadArtistsForDisplay();
        }
      },
      { threshold: 0.1 },
    );

    const currentTarget = artistsObserverTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [artistHasMore, isLoadingArtists, selectedArtist, loadArtistsForDisplay]);

  // Infinite scroll for songs
  const songsListContainerRef = useRef(null);
  const songsObserverTarget = useRef(null);
  const handleSongsScroll = useCallback(() => {
    if (!songHasMore || isLoadingSongs || !selectedArtist) return;

    const container = songsListContainerRef.current;
    if (!container) return;

    const SCROLL_THRESHOLD_PX = 36;
    const isNearBottom =
      container.scrollTop + container.clientHeight >=
      container.scrollHeight - SCROLL_THRESHOLD_PX;

    if (isNearBottom) {
      loadArtistSongs(true);
    }
  }, [songHasMore, isLoadingSongs, selectedArtist, loadArtistSongs]);

  useEffect(() => {
    const currentRoot = songsListContainerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          songHasMore &&
          !isLoadingSongs &&
          selectedArtist
        ) {
          loadArtistSongs(true);
        }
      },
      { threshold: 0.1, root: currentRoot },
    );

    const currentTarget = songsObserverTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [songHasMore, isLoadingSongs, selectedArtist, loadArtistSongs]);

  const handlePlayArtistSongs = () => {
    if (selectedArtistAllSongs.length === 0) return;
    playSong(selectedArtistAllSongs, 0);
  };

  const handleShuffleArtistSongs = () => {
    if (selectedArtistAllSongs.length === 0) return;
    const randomIndex = Math.floor(
      Math.random() * selectedArtistAllSongs.length,
    );
    playSong(selectedArtistAllSongs, randomIndex);
  };

  const handleRetryArtistSongsFetch = useCallback(() => {
    const normalizedName = normalizeSearchText(selectedArtist?.name || "");
    if (!normalizedName) return;

    setIsEnrichingSelectedArtistSongs(false);
    setIsFetchingArtistSpotifySongs(false);
    setDisplayedArtistSongs([]);
    setSongOffset(0);
    setSongHasMore(true);
    setLoadingArtistSongIndex(null);

    setArtistSongsEnrichmentState((prev) => {
      const next = { ...prev };
      delete next[normalizedName];
      return next;
    });
    const nextRefState = { ...artistSongsEnrichmentStateRef.current };
    delete nextRefState[normalizedName];
    artistSongsEnrichmentStateRef.current = nextRefState;

    setSelectedArtist((prev) => (prev ? { ...prev } : prev));
  }, [selectedArtist]);

  return (
    <div className="app-container artists-page">
      <Sidebar />
      <div className="main-content">
        <div className="artists-content-wrap">
          <div className="max-w-6xl mx-auto artists-shell">
            <div className="mb-6 p-4 rounded-2xl border border-white/10 bg-black/25">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <h1 className="text-3xl font-bold">Popular Artists</h1>
                  <p className="text-sm text-gray-400 mt-1">
                    {filteredAndSortedArtists.length} artist
                    {filteredAndSortedArtists.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setArtistQuery("");
                    setSortBy("name");
                    setRoleFilter("all");
                    setRegionFilter("all");
                  }}
                  className="px-3 py-2 text-sm rounded-lg bg-white/20 hover:bg-white/30 transition-colors w-fit"
                >
                  Reset Filters
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <input
                    ref={artistSearchInputRef}
                    type="text"
                    value={artistQuery}
                    onChange={(event) => setArtistQuery(event.target.value)}
                    placeholder="Search artists..."
                    className="sm:col-span-2 lg:col-span-1 px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-sm text-white placeholder-gray-300 focus:outline-none focus:border-yellow-400"
                  />
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-sm text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="name">A-Z</option>
                    <option value="z-a">Z-A</option>
                    <option value="songs-desc">Most Songs</option>
                    <option value="songs-asc">Least Songs</option>
                  </select>
                  <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                    className="px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-sm text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="all">All Roles</option>
                    {uniqueRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <select
                    value={regionFilter}
                    onChange={(event) => setRegionFilter(event.target.value)}
                    className="px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-sm text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="all">All Regions</option>
                    <option value="indian">Indian</option>
                    <option value="international">International</option>
                  </select>
                </div>
                {isFetchingArtistFromYouTube && (
                  <p className="text-xs text-yellow-300">
                    Searching YouTube for artist...
                  </p>
                )}
                {isFetchingArtistSpotifySongs && (
                  <p className="text-xs text-blue-300">
                    Fetching artist songs from Spotify...
                  </p>
                )}
              </div>
            </div>

            {!selectedArtist ? (
              <>
                <div className="artists-grid-scroll">
                  <div className="artists-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                    {displayedArtists.map((artist) => (
                      <button
                        key={`${normalizeSearchText(artist.name || "")}-${artist.role || "artist"}`}
                        type="button"
                        onClick={() => {
                          setSelectedArtist(artist);
                          setSongOffset(0);
                          setSongHasMore(true);
                        }}
                        className="w-full bg-black/50 backdrop-blur-lg rounded-2xl p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:bg-black/60 cursor-pointer border border-white/10"
                      >
                        <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-3 rounded-full overflow-hidden border-2 border-yellow-400">
                          <img
                            src={
                              artistImageOverrides[artist.name] ||
                              artist.image ||
                              GENERIC_ARTIST_FALLBACK_IMAGE
                            }
                            alt={artist.name}
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              handleArtistImageError(artist.name);
                            }}
                            className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                          />
                        </div>

                        <h3 className="text-lg font-semibold truncate">
                          {artist.name}
                        </h3>
                        <p className="text-sm text-gray-300 truncate">
                          {artist.role || "Artist"}
                        </p>
                        {/* <p className="text-xs text-yellow-300 mt-2">
                          {artist.songCount} song
                          {artist.songCount !== 1 ? "s" : ""}
                        </p> */}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredAndSortedArtists.length === 0 && (
                  <div className="mt-6 p-4 rounded-xl border border-white/10 bg-black/40 text-center text-gray-200">
                    No artists match your search.
                  </div>
                )}

                {artistHasMore && displayedArtists.length > 0 && (
                  <div ref={artistsObserverTarget} className="py-8 text-center">
                    {isLoadingArtists ? (
                      <div className="inline-block">
                        <div className="animate-spin">
                          <div className="w-6 h-6 border-3 border-yellow-400 border-t-transparent rounded-full" />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Scroll to load more artists...
                      </p>
                    )}
                  </div>
                )}

                {!artistHasMore && displayedArtists.length > 0 && (
                  <div className="py-6 text-center text-sm text-gray-400">
                    All {filteredAndSortedArtists.length} artists loaded
                  </div>
                )}
              </>
            ) : (
              <div className="artists-detail-panel rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {selectedArtist.name} • Songs
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {selectedArtistAllSongs.length} song
                      {selectedArtistAllSongs.length !== 1 ? "s" : ""} available
                    </p>
                    {isEnrichingSelectedArtistSongs &&
                      selectedArtistAllSongs.length <
                        MIN_SONGS_PER_SELECTED_ARTIST && (
                        <p className="text-xs text-yellow-300 mt-1">
                          Finding more songs for this artist...
                        </p>
                      )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={handleRetryArtistSongsFetch}
                      disabled={
                        isEnrichingSelectedArtistSongs ||
                        isFetchingArtistSpotifySongs
                      }
                      className="px-3 py-2 text-sm rounded-lg bg-yellow-600 hover:bg-yellow-500 text-black disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {isEnrichingSelectedArtistSongs ||
                      isFetchingArtistSpotifySongs
                        ? "Fetching..."
                        : "Fetch Songs"}
                    </button>
                    <button
                      type="button"
                      onClick={handlePlayArtistSongs}
                      disabled={selectedArtistAllSongs.length === 0}
                      className="px-3 py-2 text-sm rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      Play All
                    </button>
                    <button
                      type="button"
                      onClick={handleShuffleArtistSongs}
                      disabled={selectedArtistAllSongs.length === 0}
                      className="px-3 py-2 text-sm rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      Shuffle
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedArtist(null);
                        setDisplayedArtistSongs([]);
                      }}
                      className="px-3 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                      Back to Artists
                    </button>
                  </div>
                </div>

                {selectedArtistAllSongs.length > 0 ? (
                  <div
                    ref={songsListContainerRef}
                    onScroll={handleSongsScroll}
                    className="space-y-2 artists-song-list-scroll"
                  >
                    {displayedArtistSongs.map((song, index) => {
                      const isCurrentSong =
                        currentSong?.title === song.title &&
                        currentSong?.artist === song.artist;

                      return (
                        <button
                          key={`${song.title}-${song.artist}-${index}`}
                          type="button"
                          onClick={() => handlePlayArtistSong(song, index)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                            isCurrentSong
                              ? "bg-yellow-700/50"
                              : "bg-black/30 hover:bg-black/45"
                          }`}
                        >
                          <div className="text-left overflow-hidden flex-1">
                            <p className="font-medium truncate">{song.title}</p>
                            <p className="text-sm text-gray-300 truncate">
                              {song.artist}
                            </p>
                          </div>
                          <span className="text-xs text-gray-300 ml-3 whitespace-nowrap">
                            {loadingArtistSongIndex === index
                              ? "Loading..."
                              : song.duration
                                ? formatTime(song.duration)
                                : "--:--"}
                          </span>
                        </button>
                      );
                    })}

                    {songHasMore && (
                      <div
                        ref={songsObserverTarget}
                        className="py-4 text-center"
                      >
                        {isLoadingSongs ? (
                          <div className="inline-block">
                            <div className="animate-spin">
                              <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full" />
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">
                            Scroll to load more songs...
                          </p>
                        )}
                      </div>
                    )}

                    {!songHasMore && displayedArtistSongs.length > 0 && (
                      <div className="py-4 text-center text-sm text-gray-400">
                        All {selectedArtistAllSongs.length} songs loaded
                      </div>
                    )}
                  </div>
                ) : isEnrichingSelectedArtistSongs ? (
                  <div className="p-4 rounded-lg bg-black/20 text-gray-300">
                    <p>Loading songs for this artist...</p>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-black/20 text-gray-300 flex items-center justify-between gap-3">
                    <p>
                      No songs found for this artist in your current catalog.
                    </p>
                    <button
                      type="button"
                      onClick={handleRetryArtistSongsFetch}
                      className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-black text-sm font-medium transition-colors"
                    >
                      Fetch Songs
                    </button>
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
