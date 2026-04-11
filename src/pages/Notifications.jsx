import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const loadNotifications = async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message || "Failed to load notifications");
      setNotifications([]);
      setLoading(false);
      return;
    }

    setNotifications(data || []);
    setLoading(false);
  };

  const handleDeleteNotification = async (notificationId) => {
    setDeletingId(notificationId);
    setError("");

    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (deleteError) {
      setError(deleteError.message || "Failed to delete notification");
      setDeletingId(null);
      return;
    }

    setNotifications((prev) =>
      Array.isArray(prev) ? prev.filter((n) => n.id !== notificationId) : [],
    );
    setDeletingId(null);
  };

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel("realtime:notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          loadNotifications();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="standalone-page-shell">
      <div className="standalone-page-panel max-w-2xl">
        <h1 className="standalone-page-title text-center">Notifications</h1>
        <p className="standalone-page-subtitle text-center mb-5">
          Stay updated with your latest account and activity alerts.
        </p>

        <button
          type="button"
          onClick={loadNotifications}
          className="w-full mb-6 bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 transition-opacity p-3 rounded-xl font-semibold"
        >
          Refresh Notifications
        </button>

        {loading && (
          <div className="bg-black/60 p-4 rounded-xl mb-3 text-center text-gray-200">
            Loading notifications...
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-900/40 border border-red-500/50 p-4 rounded-xl mb-3 text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div className="bg-black/60 p-4 rounded-xl mb-3 text-gray-300">
            No notifications yet.
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto pr-2">
          {!loading &&
            !error &&
            notifications.map((notification) => (
              <div
                key={notification.id}
                className="bg-black/60 p-4 rounded-xl mb-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-white mb-1">
                      {notification.title || "Notification"}
                    </p>
                    <p className="text-gray-200">{notification.message}</p>
                    {notification.created_at && (
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteNotification(notification.id)}
                    disabled={deletingId === notification.id}
                    className="text-red-300 hover:text-red-200 text-lg leading-none px-2 py-1 rounded-md border border-red-400/40 hover:border-red-300/60 disabled:opacity-60"
                    aria-label="Delete notification"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
