import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import { PlayerProvider } from "./context/PlayerContext";
import { PlaylistProvider } from "./context/PlaylistContext";
import { SpotifyProvider } from "./context/SpotifyContext";
import { SongProvider } from "./context/SongContext";
import { BrowserRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <AuthProvider>
      <PlayerProvider>
        <PlaylistProvider>
          <SpotifyProvider>
            <SongProvider>
              <App />
            </SongProvider>
          </SpotifyProvider>
        </PlaylistProvider>
      </PlayerProvider>
    </AuthProvider>
  </BrowserRouter>,
);
