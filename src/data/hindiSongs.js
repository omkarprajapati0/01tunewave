const SUPABASE_STORAGE_BASE = `${(
  import.meta.env.VITE_SUPABASE_URL || "https://your-project-ref.supabase.co"
).replace(/\/$/, "")}/storage/v1/object/public/tunewave`;

export const hindiSongs = [
  {
    title: "Kesariya",
    artist: "Arijit Singh",
    src: `${SUPABASE_STORAGE_BASE}/kesariya.mp3`,
    cover: "/Logo-icon.png",
  },
  {
    title: "Tum Hi Ho",
    artist: "Arijit Singh",
    src: `${SUPABASE_STORAGE_BASE}/tum_hi_ho.mp3`,
    cover: "/Logo-icon.png",
  },
];
