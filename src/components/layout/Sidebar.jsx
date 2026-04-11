import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

export default function Sidebar({ showArtistSearch = true }) {
  const navigate = useNavigate();
  const [sidebarSearch, setSidebarSearch] = useState("");

  const handleSidebarSearch = (event) => {
    event.preventDefault();
    const query = sidebarSearch.trim();

    if (!query) {
      navigate("/homepage");
      return;
    }

    navigate(`/homepage?search=${encodeURIComponent(query)}`);
  };

  return (
    <aside className="sidebar">
      <h2>Library</h2>
      {showArtistSearch && (
        <form className="sidebar-artist-search" onSubmit={handleSidebarSearch}>
          <input
            type="text"
            value={sidebarSearch}
            onChange={(event) => setSidebarSearch(event.target.value)}
            placeholder="Search songs, artists, albums..."
            aria-label="Universal search"
          />
          <button type="submit">Search</button>
        </form>
      )}
      <nav>
        <NavLink
          to="/homepage"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Home
        </NavLink>
        <NavLink
          to="/artists"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Artists
        </NavLink>
        <NavLink
          to="/albums"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Albums
        </NavLink>
        {/* <NavLink
          to="/spotify"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Spotify
        </NavLink> */}
      </nav>

      <h3>• Song Categories</h3>
      <nav>
        <NavLink
          to="/english"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          English Songs
        </NavLink>
        <NavLink
          to="/hindi"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Hindi Songs
        </NavLink>
        <NavLink
          to="/marathi"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Marathi Songs
        </NavLink>
        <NavLink
          to="/playlists"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          My playlist
        </NavLink>
      </nav>
    </aside>
  );
}
