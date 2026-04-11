import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlaylist } from "../context/PlaylistContext";

const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' fill='%2327272a'/%3E%3Ccircle cx='60' cy='45' r='22' fill='%2371717a'/%3E%3Cpath d='M18 110c4-24 18-36 42-36s38 12 42 36' fill='%2371717a'/%3E%3C/svg%3E";

export default function Account() {
  const navigate = useNavigate();
  const {
    user,
    signOut,
    updateProfile,
    uploadAvatar,
    loading,
    error,
    clearError,
  } = useAuth();
  const { playlists, favorites } = usePlaylist();

  const [activeTab, setActiveTab] = useState("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [editError, setEditError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef(null);

  // Initialize form values from user data
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    }
  }, [user]);

  // Clear messages when switching tabs
  useEffect(() => {
    setEditError("");
    setSuccessMessage("");
    clearError();
  }, [activeTab, clearError]);

  // Show auth errors
  useEffect(() => {
    if (error) {
      setEditError(error);
    }
  }, [error]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center text-white p-4">
        <div className="bg-black/50 backdrop-blur-xl rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Not Logged In</h2>
          <p className="text-gray-300 mb-6">
            Please log in to view your account.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:opacity-90 transition"
          >
            Go to Login
          </button>
          <button
            onClick={() => navigate("/homepage")}
            className="mt-3 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-semibold transition"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    const result = await signOut();
    if (result.success) {
      navigate("/");
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith("image/")) {
      setEditError("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setEditError("Image must be less than 2MB");
      return;
    }

    const result = await uploadAvatar(file);
    if (result.success) {
      setSuccessMessage("Avatar updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  };

  const handleSaveProfile = async () => {
    setEditError("");
    setSuccessMessage("");

    if (!fullName.trim()) {
      setEditError("Full name is required");
      return;
    }

    const result = await updateProfile({ full_name: fullName.trim() });
    if (result.success) {
      setSuccessMessage("Profile updated successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  };

  const getAvatarUrl = () => {
    return user?.user_metadata?.avatar_url || DEFAULT_AVATAR;
  };

  const getDisplayName = () => {
    return user?.user_metadata?.full_name || "Music Lover";
  };

  const userPlaylists = playlists || [];
  const userFavorites = favorites || [];
  const totalSongs = userPlaylists.reduce(
    (acc, playlist) => acc + (playlist.songs?.length || 0),
    0,
  );

  const tabs = [
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "playlists", label: "My Playlists", icon: "🎵" },
    { id: "stats", label: "Statistics", icon: "📊" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">My Account</h1>
            <p className="text-gray-400">
              Manage your profile, playlists, and preferences
            </p>
          </div>
          <button
            onClick={() => navigate("/homepage")}
            className="self-start px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition font-medium"
          >
            Back to Home
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - User Card */}
          <div className="lg:col-span-1">
            <div className="bg-black/30 backdrop-blur-xl rounded-2xl p-6 sticky top-4">
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <img
                    src={getAvatarUrl()}
                    alt="Profile"
                    className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-purple-500/30 cursor-pointer hover:opacity-80 transition"
                    onClick={handleAvatarClick}
                  />
                  <button
                    onClick={handleAvatarClick}
                    className="absolute bottom-0 right-0 bg-purple-600 p-2 rounded-full hover:bg-purple-700 transition"
                    title="Change avatar"
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
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/*"
                  className="hidden"
                />
                <h2 className="text-xl font-semibold">{getDisplayName()}</h2>
                <p className="text-gray-400 text-sm truncate">{user.email}</p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {userPlaylists.length}
                  </div>
                  <div className="text-xs text-gray-400">Playlists</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-pink-400">
                    {userFavorites.length}
                  </div>
                  <div className="text-xs text-gray-400">Favorites</div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <nav className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                      activeTab === tab.id
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                        : "bg-white/5 hover:bg-white/10 text-gray-300"
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span className="font-medium">{tab.label}</span>
                  </button>
                ))}
              </nav>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full mt-4 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl transition flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Logout
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {/* Messages */}
            {editError && (
              <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-300">
                {editError}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 bg-green-500/20 border border-green-500/50 rounded-xl p-4 text-green-300">
                {successMessage}
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="bg-black/30 backdrop-blur-xl rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">Profile Information</h3>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                  >
                    {isEditing ? "Cancel" : "Edit Profile"}
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Full Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:outline-none transition"
                        placeholder="Enter your full name"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-white/5 rounded-xl">
                        {getDisplayName()}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Email Address
                    </label>
                    <div className="px-4 py-3 bg-white/5 rounded-xl text-gray-300">
                      {user.email}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Member Since
                    </label>
                    <div className="px-4 py-3 bg-white/5 rounded-xl text-gray-300">
                      {new Date(user.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  </div>

                  {isEditing && (
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
                    >
                      {loading ? "Saving..." : "Save Changes"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Playlists Tab */}
            {activeTab === "playlists" && (
              <div className="bg-black/30 backdrop-blur-xl rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">My Playlists</h3>
                  <Link
                    to="/playlists"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                  >
                    Manage Playlists
                  </Link>
                </div>

                {userPlaylists.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎵</div>
                    <h4 className="text-lg font-semibold mb-2">
                      No playlists yet
                    </h4>
                    <p className="text-gray-400 mb-4">
                      Create your first playlist to get started
                    </p>
                    <Link
                      to="/playlists"
                      className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold hover:opacity-90 transition"
                    >
                      Create Playlist
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userPlaylists.map((playlist) => (
                      <Link
                        key={playlist.id}
                        to={`/playlist/${playlist.id}`}
                        className="bg-white/5 hover:bg-white/10 rounded-xl p-4 transition group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-2xl">
                            🎵
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate group-hover:text-purple-400 transition">
                              {playlist.name}
                            </h4>
                            <p className="text-sm text-gray-400">
                              {playlist.songs?.length || 0} songs
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === "stats" && (
              <div className="bg-black/30 backdrop-blur-xl rounded-2xl p-6">
                <h3 className="text-xl font-semibold mb-6">Your Statistics</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-xl p-6 text-center">
                    <div className="text-4xl font-bold text-purple-400 mb-2">
                      {userPlaylists.length}
                    </div>
                    <div className="text-gray-400">Total Playlists</div>
                  </div>
                  <div className="bg-gradient-to-br from-pink-600/20 to-pink-800/20 rounded-xl p-6 text-center">
                    <div className="text-4xl font-bold text-pink-400 mb-2">
                      {totalSongs}
                    </div>
                    <div className="text-gray-400">Total Songs</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-xl p-6 text-center">
                    <div className="text-4xl font-bold text-blue-400 mb-2">
                      {userFavorites.length}
                    </div>
                    <div className="text-gray-400">Favorite Songs</div>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-6">
                  <h4 className="font-semibold mb-4">Recent Activity</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-gray-300">
                        Joined TuneWave on{" "}
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {userPlaylists.length > 0 && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                        <span className="text-gray-300">
                          Created {userPlaylists.length} playlist(s)
                        </span>
                      </div>
                    )}
                    {userFavorites.length > 0 && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="w-2 h-2 bg-pink-500 rounded-full"></span>
                        <span className="text-gray-300">
                          Added {userFavorites.length} song(s) to favorites
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
