import { useState, useRef, useEffect } from "react";
import { usePlaylist } from "../context/PlaylistContext";

export default function PlaylistDropdown({ song }) {
  const { playlists, createPlaylist, addSongToPlaylist } = usePlaylist();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [addedTo, setAddedTo] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowCreate(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreateAndAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (newPlaylistName.trim()) {
      const newPlaylist = createPlaylist(newPlaylistName);
      if (newPlaylist && song) {
        addSongToPlaylist(newPlaylist.id, song);
        setAddedTo(newPlaylist.id);
      }
      setNewPlaylistName("");
      setShowCreate(false);
      setIsOpen(false);
    }
  };

  const handleAddToPlaylist = (e, playlistId) => {
    e.stopPropagation();
    if (song) {
      addSongToPlaylist(playlistId, song);
      setAddedTo(playlistId);
      setTimeout(() => {
        setIsOpen(false);
        setAddedTo(null);
      }, 800);
    }
  };

  return (
    <div
      className="playlist-dropdown"
      ref={dropdownRef}
      style={{ position: "relative" }}
    >
      {/* Dropdown Toggle Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "#fff",
          cursor: "pointer",
          padding: "8px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.2s",
        }}
        title="Add to playlist"
      >
        <i className="fa-solid fa-plus-circle" style={{ fontSize: "18px" }}></i>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: "0",
            top: "100%",
            background: "#2f2f2f",
            borderRadius: "12px",
            padding: "10px",
            minWidth: "200px",
            maxHeight: "300px",
            overflowY: "auto",
            zIndex: 1000,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            marginTop: "5px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Create New Playlist Option */}
          {!showCreate ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCreate(true);
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "linear-gradient(270deg, #cb3391, #2d30eb)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <i className="fa-solid fa-plus"></i> Create Playlist
            </button>
          ) : (
            <form onSubmit={handleCreateAndAdd} style={{ marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Playlist name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "none",
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  fontSize: "13px",
                  marginBottom: "8px",
                  outline: "none",
                }}
                autoFocus
              />
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCreate(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #666",
                    background: "transparent",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: "none",
                    background: "linear-gradient(270deg, #cb3391, #2d30eb)",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "12px",
                  }}
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {/* Existing Playlists */}
          {playlists.length > 0 && (
            <>
              <div
                style={{
                  color: "#999",
                  fontSize: "11px",
                  marginBottom: "8px",
                  marginTop: "4px",
                }}
              >
                YOUR PLAYLISTS
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={(e) => handleAddToPlaylist(e, playlist.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background:
                        addedTo === playlist.id
                          ? "rgba(45, 48, 235, 0.3)"
                          : "rgba(255,255,255,0.05)",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "13px",
                      transition: "background 0.2s",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <i
                        className="fa-solid fa-list-ul"
                        style={{ color: "#667eea", fontSize: "12px" }}
                      ></i>
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {playlist.name}
                      </span>
                    </div>
                    {addedTo === playlist.id && (
                      <i
                        className="fa-solid fa-check"
                        style={{ color: "#4ade80", fontSize: "12px" }}
                      ></i>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {playlists.length === 0 && !showCreate && (
            <p
              style={{
                color: "#999",
                textAlign: "center",
                fontSize: "12px",
                padding: "10px 0",
              }}
            >
              No playlists yet
            </p>
          )}
        </div>
      )}
    </div>
  );
}
