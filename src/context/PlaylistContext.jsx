import { createContext, useContext, useState, useEffect } from "react";
import { transformTrack, hasPlayableSource } from "../utils/spotifyHelpers";
import { hasSupabaseEnvConfig, supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const PlaylistContext = createContext();
const IS_DEV = import.meta.env.DEV;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => UUID_REGEX.test((value || "").toString().trim());

const createPlaylistId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const random = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  return `${random()}${random()}-${random()}-4${random().slice(0, 3)}-a${random().slice(0, 3)}-${random()}${random()}${random()}`;
};

const normalizePlaylistId = (value) => {
  const id = (value || "").toString().trim();
  return isUuid(id) ? id : createPlaylistId();
};

const normalizePlaylistsForStorage = (playlists = []) =>
  playlists.map((playlist) => ({
    ...playlist,
    id: normalizePlaylistId(playlist?.id),
  }));

const getInitialPlaylistsState = () => {
  const saved = localStorage.getItem("tunewave_playlists");
  if (!saved) {
    return { playlists: [], migratedCount: 0 };
  }

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return { playlists: [], migratedCount: 0 };
    }

    let migratedCount = 0;
    const normalizedPlaylists = parsed.map((playlist) => {
      const normalizedId = normalizePlaylistId(playlist?.id);
      const originalId = (playlist?.id || "").toString().trim();
      if (!isUuid(originalId)) {
        migratedCount += 1;
      }

      return {
        ...playlist,
        id: normalizedId,
      };
    });

    return {
      playlists: normalizedPlaylists,
      migratedCount,
    };
  } catch {
    return { playlists: [], migratedCount: 0 };
  }
};

export const PlaylistProvider = ({ children }) => {
  const initialPlaylistsState = getInitialPlaylistsState();
  const { user } = useAuth();
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [playlistIdMigrationCount] = useState(
    initialPlaylistsState.migratedCount,
  );
  const [showPlaylistMigrationNotice, setShowPlaylistMigrationNotice] =
    useState(initialPlaylistsState.migratedCount > 0);

  const normalizeSongForSupabase = (song = {}) => ({
    title: song.title || "",
    artist: song.artist || "",
    cover: song.cover || "",
    src: song.src || "",
    srcType: song.srcType || "",
    duration: Number.isFinite(song.duration) ? song.duration : 0,
    source: song.source || "local",
    spotifyId: song.spotifyId || null,
    needsYouTubeFallback: Boolean(song.needsYouTubeFallback),
  });

  const parseSongsFromSupabase = (songsValue) => {
    if (!Array.isArray(songsValue)) return [];

    return songsValue
      .map((song) => {
        if (!song || typeof song !== "object") return null;

        return {
          title: song.title,
          artist: song.artist,
          cover: song.cover,
          src: song.src,
          srcType: song.srcType,
          duration: song.duration,
          source: song.source,
          spotifyId: song.spotifyId,
          needsYouTubeFallback: song.needsYouTubeFallback,
        };
      })
      .filter(Boolean);
  };

  // Load playlists from localStorage on init
  const [playlists, setPlaylists] = useState(initialPlaylistsState.playlists);

  // Load favorites from localStorage on init
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("tunewave_favorites");
    return saved ? JSON.parse(saved) : [];
  });

  // Load favorites from Supabase when user is authenticated
  useEffect(() => {
    const loadFavoritesFromSupabase = async () => {
      if (!user || !hasSupabaseEnvConfig) return;

      try {
        setSyncLoading(true);
        const { data, error } = await supabase
          .from("favorites")
          .select("*")
          .eq("user_id", user.id);

        if (error) throw error;

        if (data && data.length > 0) {
          const formattedFavorites = data.map((item) => ({
            title: item.title,
            artist: item.artist,
            cover: item.cover,
            src: item.src,
            srcType: item.src_type,
            duration: item.duration,
            source: item.source,
            spotifyId: item.spotify_id,
            needsYouTubeFallback: item.needs_youtube_fallback,
          }));
          setFavorites(formattedFavorites);
        }
      } catch (err) {
        if (IS_DEV) {
          console.error("Error loading favorites from Supabase:", err);
        }
        setSyncError(err.message);
      } finally {
        setSyncLoading(false);
      }
    };

    loadFavoritesFromSupabase();
  }, [user]);

  // Sync favorites to Supabase when they change
  useEffect(() => {
    const syncFavoritesToSupabase = async () => {
      if (!user || !hasSupabaseEnvConfig || favorites.length === 0) return;

      try {
        // Delete existing favorites for this user
        await supabase.from("favorites").delete().eq("user_id", user.id);

        // Insert new favorites
        const favoritesToInsert = favorites.map((song) => ({
          user_id: user.id,
          title: song.title,
          artist: song.artist,
          cover: song.cover,
          src: song.src,
          src_type: song.srcType,
          duration: song.duration,
          source: song.source || "local",
          spotify_id: song.spotifyId || null,
          needs_youtube_fallback: song.needsYouTubeFallback || false,
          created_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from("favorites")
          .insert(favoritesToInsert);

        if (error) throw error;
      } catch (err) {
        if (IS_DEV) {
          console.error("Error syncing favorites to Supabase:", err);
        }
      }
    };

    // Only sync if user is authenticated and we have favorites
    if (user && favorites.length > 0) {
      syncFavoritesToSupabase();
    }
  }, [favorites, user]);

  // Load Spotify playlists from localStorage
  const [spotifyPlaylists, setSpotifyPlaylists] = useState(() => {
    const saved = localStorage.getItem("tunewave_spotify_playlists");
    return saved ? JSON.parse(saved) : [];
  });

  // Load playlists from Supabase when user is authenticated
  useEffect(() => {
    const loadPlaylistsFromSupabase = async () => {
      if (!user || !hasSupabaseEnvConfig) return;

      try {
        setSyncLoading(true);

        // Load user playlists by user_id, with user_email fallback for migrated rows.
        const { data: playlistsData, error: playlistsError } = await supabase
          .from("playlists")
          .select("*")
          .eq("user_id", user.id);

        if (playlistsError) throw playlistsError;

        let effectivePlaylists = playlistsData || [];

        if (effectivePlaylists.length === 0 && user.email) {
          const { data: emailPlaylists, error: emailPlaylistsError } =
            await supabase
              .from("playlists")
              .select("*")
              .eq("user_email", user.email);

          if (!emailPlaylistsError && Array.isArray(emailPlaylists)) {
            effectivePlaylists = emailPlaylists;
          }
        }

        const playlistsWithSongs = (effectivePlaylists || []).map(
          (playlist) => ({
            id: playlist.id,
            name: playlist.name,
            createdAt: playlist.created_at,
            songs: parseSongsFromSupabase(playlist.songs),
          }),
        );

        setPlaylists(playlistsWithSongs);
      } catch (err) {
        if (IS_DEV) {
          console.error("Error loading playlists from Supabase:", err);
        }
        setSyncError(err.message);
      } finally {
        setSyncLoading(false);
      }
    };

    loadPlaylistsFromSupabase();
  }, [user]);

  // Sync playlists to Supabase when they change
  useEffect(() => {
    const syncPlaylistsToSupabase = async () => {
      if (!user || !hasSupabaseEnvConfig || playlists.length === 0) return;

      try {
        // Get existing playlist IDs from Supabase
        const { data: existingPlaylists, error: fetchError } = await supabase
          .from("playlists")
          .select("id")
          .eq("user_id", user.id);

        if (fetchError) throw fetchError;

        const existingIds = new Set((existingPlaylists || []).map((p) => p.id));
        const playlistsWithValidIds = normalizePlaylistsForStorage(playlists);

        if (
          playlistsWithValidIds.some(
            (playlist, index) => playlist.id !== playlists[index]?.id,
          )
        ) {
          setPlaylists(playlistsWithValidIds);
        }

        const currentIds = new Set(playlistsWithValidIds.map((p) => p.id));

        // Delete playlists that no longer exist locally
        const idsToDelete = [...existingIds].filter(
          (id) => !currentIds.has(id),
        );
        if (idsToDelete.length > 0) {
          await supabase.from("playlists").delete().in("id", idsToDelete);
        }

        // Upsert current playlists
        for (const playlist of playlistsWithValidIds) {
          // Upsert playlist
          const { error: playlistError } = await supabase
            .from("playlists")
            .upsert(
              {
                id: playlist.id,
                user_id: user.id,
                user_email: user.email || null,
                name: playlist.name,
                songs: Array.isArray(playlist.songs)
                  ? playlist.songs.map(normalizeSongForSupabase)
                  : [],
                created_at: playlist.createdAt || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" },
            );

          if (playlistError) {
            if (
              playlistError.code === "22P02" &&
              playlistError.message
                ?.toLowerCase()
                .includes("invalid input syntax for type uuid")
            ) {
              continue;
            }
            throw playlistError;
          }
        }
      } catch (err) {
        if (IS_DEV) {
          console.error("Error syncing playlists to Supabase:", err);
        }
      }
    };

    // Only sync if user is authenticated and we have playlists
    if (user && hasSupabaseEnvConfig && playlists.length > 0) {
      syncPlaylistsToSupabase();
    }
  }, [playlists, user]);

  // Save to localStorage whenever playlists change
  useEffect(() => {
    localStorage.setItem("tunewave_playlists", JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    if (!showPlaylistMigrationNotice) return;

    const timeoutId = window.setTimeout(() => {
      setShowPlaylistMigrationNotice(false);
    }, 6000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showPlaylistMigrationNotice]);

  // Save to localStorage whenever favorites change
  useEffect(() => {
    localStorage.setItem("tunewave_favorites", JSON.stringify(favorites));
  }, [favorites]);

  // Save to localStorage whenever Spotify playlists change
  useEffect(() => {
    localStorage.setItem(
      "tunewave_spotify_playlists",
      JSON.stringify(spotifyPlaylists),
    );
  }, [spotifyPlaylists]);

  const visiblePlaylists = user ? playlists : [];
  const visibleSpotifyPlaylists = user ? spotifyPlaylists : [];
  const visibleFavorites = user ? favorites : [];

  // Add song to favorites
  const addToFavorites = (song) => {
    if (!user) return;
    setFavorites((prev) => {
      // Check if song already exists in favorites
      const exists = prev.some(
        (s) => s.title === song.title && s.artist === song.artist,
      );
      if (exists) return prev;
      return [...prev, song];
    });
  };

  // Remove song from favorites
  const removeFromFavorites = (song) => {
    if (!user) return;
    setFavorites((prev) =>
      prev.filter((s) => !(s.title === song.title && s.artist === song.artist)),
    );
  };

  // Check if song is in favorites
  const isInFavorites = (song) => {
    return favorites.some(
      (s) => s.title === song.title && s.artist === song.artist,
    );
  };

  // Create a new playlist
  const createPlaylist = (name) => {
    if (!user) return null;
    if (!name.trim()) return null;

    const newPlaylist = {
      id: createPlaylistId(),
      name: name.trim(),
      songs: [],
      createdAt: new Date().toISOString(),
    };

    setPlaylists((prev) => [...prev, newPlaylist]);
    return newPlaylist;
  };

  // Delete a playlist
  const deletePlaylist = (playlistId) => {
    if (!user) return;
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
  };

  // Add song to playlist
  const addSongToPlaylist = (playlistId, song) => {
    if (!user) return;
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;

        // Check if song already exists in playlist
        const exists = playlist.songs.some(
          (s) => s.title === song.title && s.artist === song.artist,
        );

        if (exists) return playlist;

        // Ensure song has proper source fields for playback
        const songWithSource = {
          ...song,
          source: song.source || "local",
          srcType: song.srcType || (song.src ? "audio" : ""),
          needsYouTubeFallback:
            song.needsYouTubeFallback || !song.src || song.src === "",
        };

        return {
          ...playlist,
          songs: [...playlist.songs, songWithSource],
        };
      }),
    );
  };

  // Remove song from playlist
  const removeSongFromPlaylist = (playlistId, songIndex) => {
    if (!user) return;
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;

        return {
          ...playlist,
          songs: playlist.songs.filter((_, i) => i !== songIndex),
        };
      }),
    );
  };

  // Rename playlist
  const renamePlaylist = (playlistId, newName) => {
    if (!user) return;
    if (!newName.trim()) return;

    setPlaylists((prev) =>
      prev.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, name: newName.trim() }
          : playlist,
      ),
    );
  };

  // Get a specific playlist
  const getPlaylist = (playlistId) => {
    return visiblePlaylists.find((p) => p.id === playlistId);
  };

  // Import Spotify playlist
  const importSpotifyPlaylist = (spotifyPlaylist) => {
    if (!user) return null;
    const newPlaylist = {
      id: `spotify_${spotifyPlaylist.id}_${Date.now()}`,
      name: spotifyPlaylist.name,
      description: spotifyPlaylist.description || "",
      cover: spotifyPlaylist.cover || spotifyPlaylist.images?.[0]?.url,
      songs: spotifyPlaylist.songs || [],
      createdAt: new Date().toISOString(),
      source: "spotify",
      spotifyId: spotifyPlaylist.id,
    };

    setSpotifyPlaylists((prev) => [...prev, newPlaylist]);
    return newPlaylist;
  };

  // Add songs from Spotify to a local playlist
  const addSpotifySongsToPlaylist = (playlistId, spotifyTracks) => {
    if (!user) return;
    const transformedSongs = spotifyTracks
      .map((track) => {
        // If already transformed, use as-is
        if (track.title && track.artist) return track;
        // Transform Spotify track
        return transformTrack(track);
      })
      .filter(Boolean)
      .map((song) => ({
        ...song,
        // Ensure needsYouTubeFallback is set correctly for songs without preview_url
        needsYouTubeFallback:
          song.needsYouTubeFallback || !song.src || song.src === "",
      }));

    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;

        // Include all songs, even those needing YouTube fallback
        // Filter out songs without any playable source (no src and no YouTube fallback possible)
        const playableSongs = transformedSongs.filter(
          (song) => hasPlayableSource(song) || song.needsYouTubeFallback,
        );

        // Add only new songs
        const existingTitles = new Set(
          playlist.songs.map((s) => `${s.title}-${s.artist}`),
        );

        const newSongs = playableSongs.filter(
          (s) => !existingTitles.has(`${s.title}-${s.artist}`),
        );

        return {
          ...playlist,
          songs: [...playlist.songs, ...newSongs],
        };
      }),
    );
  };

  // Get a specific Spotify playlist
  const getSpotifyPlaylist = (playlistId) => {
    return visibleSpotifyPlaylists.find((p) => p.id === playlistId);
  };

  // Delete a Spotify playlist
  const deleteSpotifyPlaylist = (playlistId) => {
    if (!user) return;
    setSpotifyPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
  };

  // Add Spotify track to favorites
  const addSpotifyToFavorites = (spotifyTrack) => {
    if (!user) return;
    const track = transformTrack(spotifyTrack);
    if (!track) return;

    setFavorites((prev) => {
      // Check if song already exists in favorites
      const exists = prev.some(
        (s) =>
          (s.spotifyId && s.spotifyId === track.spotifyId) ||
          (s.title === track.title && s.artist === track.artist),
      );
      if (exists) return prev;
      return [...prev, track];
    });
  };

  // Get all favorites (including Spotify)
  const getAllFavorites = () => {
    return visibleFavorites;
  };

  // Clear all user data (for logout/account deletion)
  const clearUserData = () => {
    setPlaylists([]);
    setFavorites([]);
    setSpotifyPlaylists([]);
    localStorage.removeItem("tunewave_playlists");
    localStorage.removeItem("tunewave_favorites");
    localStorage.removeItem("tunewave_spotify_playlists");
  };

  return (
    <PlaylistContext.Provider
      value={{
        playlists: visiblePlaylists,
        spotifyPlaylists: visibleSpotifyPlaylists,
        favorites: visibleFavorites,
        createPlaylist,
        deletePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        renamePlaylist,
        getPlaylist,
        importSpotifyPlaylist,
        addSpotifySongsToPlaylist,
        getSpotifyPlaylist,
        deleteSpotifyPlaylist,
        addSpotifyToFavorites,
        getAllFavorites,
        addToFavorites,
        removeFromFavorites,
        isInFavorites,
        clearUserData,
        syncLoading,
        syncError,
        playlistIdMigrationCount,
        showPlaylistMigrationNotice,
        dismissPlaylistMigrationNotice: () =>
          setShowPlaylistMigrationNotice(false),
        isAuthenticated: !!user,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
};

export const usePlaylist = () => useContext(PlaylistContext);
