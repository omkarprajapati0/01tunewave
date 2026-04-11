import { useState } from "react";
import { usePlaylist } from "../context/PlaylistContext";

export default function AddToPlaylist({ song, onClose }) {
  const { playlists, addSongToPlaylist, createPlaylist } = usePlaylist();
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [addedTo, setAddedTo] = useState(null);

  const handleAddToPlaylist = (playlistId) => {
    addSongToPlaylist(playlistId, song);
    setAddedTo(playlistId);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handleCreateAndAdd = (e) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      const newPlaylist = createPlaylist(newPlaylistName);
      if (newPlaylist) {
        addSongToPlaylist(newPlaylist.id, song);
        setAddedTo(newPlaylist.id);
        setTimeout(() => {
          onClose();
        }, 800);
      }
    }
  };

  return (
    <div className="add-playlist-modal-overlay" onClick={onClose}>
      <div className="add-playlist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-playlist-modal-header">
          <h3>Add to Playlist</h3>
          <button onClick={onClose} className="add-playlist-close-btn">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {/* Song info */}
        <div className="add-playlist-song-info">
          <img
            src={song.cover}
            alt={song.title}
            className="add-playlist-song-cover"
          />
          <div>
            <div className="add-playlist-song-title">{song.title}</div>
            <div className="add-playlist-song-artist">{song.artist}</div>
          </div>
        </div>

        {/* Create new playlist button */}
        {!showNewPlaylist ? (
          <button
            onClick={() => setShowNewPlaylist(true)}
            className="add-playlist-create-new"
          >
            <i className="fa-solid fa-plus"></i> Create New Playlist
          </button>
        ) : (
          <form onSubmit={handleCreateAndAdd} className="add-playlist-new-form">
            <input
              type="text"
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="add-playlist-new-input"
              autoFocus
            />
            <div className="add-playlist-new-actions">
              <button
                type="button"
                onClick={() => setShowNewPlaylist(false)}
                className="add-playlist-cancel-btn"
              >
                Cancel
              </button>
              <button type="submit" className="add-playlist-submit-btn">
                Create & Add
              </button>
            </div>
          </form>
        )}

        {/* Existing playlists */}
        {playlists.length > 0 && (
          <>
            <div className="add-playlist-section-title">YOUR PLAYLISTS</div>
            <div className="add-playlist-list">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => handleAddToPlaylist(playlist.id)}
                  className={`add-playlist-item ${addedTo === playlist.id ? "is-added" : ""}`}
                >
                  <div className="add-playlist-item-left">
                    <i className="fa-solid fa-list-ul"></i>
                    <span>{playlist.name}</span>
                  </div>
                  {addedTo === playlist.id ? (
                    <i className="fa-solid fa-check add-playlist-added-icon"></i>
                  ) : (
                    <span className="add-playlist-song-count">
                      {playlist.songs.length} songs
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {playlists.length === 0 && !showNewPlaylist && (
          <p className="add-playlist-empty-note">
            No playlists yet. Create your first one!
          </p>
        )}
      </div>
    </div>
  );
}
