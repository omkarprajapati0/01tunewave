import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Landing from "./pages/Landing";
import Home from "./pages/Home";
import EnglishSongs from "./pages/EnglishSongs";
import HindiSongs from "./pages/HindiSongs";
import MarathiSongs from "./pages/MarathiSongs";
import Artists from "./pages/Artists";
import Playlists from "./pages/Playlists";
import PlaylistDetail from "./pages/PlaylistDetail";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Account from "./pages/Account";
import Notifications from "./pages/Notifications";
import Help from "./pages/Help";
import About from "./pages/About";
import Spotify from "./pages/Spotify";
import Albums from "./pages/Albums";

import FooterPlayer from "./components/layout/FooterPlayer";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const location = useLocation();

  // Hide footer player only on auth pages and landing page
  // Category pages (english, hindi, marathi) can show footer player for playback controls
  const hideFooterPlayer = ["/", "/login", "/reset-password"].includes(
    location.pathname,
  );

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/homepage" element={<Home />} />
        <Route
          path="/all-songs"
          element={<Navigate to="/homepage" replace />}
        />
        <Route path="/english" element={<EnglishSongs />} />
        <Route path="/hindi" element={<HindiSongs />} />
        <Route path="/marathi" element={<MarathiSongs />} />
        <Route path="/artists" element={<Artists />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlist/:id" element={<PlaylistDetail />} />
        <Route path="/spotify" element={<Spotify />} />
        <Route path="/albums" element={<Albums />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route path="/help" element={<Help />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/homepage" replace />} />
      </Routes>

      {/* Global music player - hidden on landing and login */}
      {!hideFooterPlayer && <FooterPlayer />}
    </>
  );
}
