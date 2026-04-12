const SUPABASE_STORAGE_BASE = `${(
  import.meta.env.VITE_SUPABASE_URL || "https://your-project-ref.supabase.co"
).replace(/\/$/, "")}/storage/v1/object/public/tunewave`;

export const englishSongs = [
  {
    title: "Sapphire",
    artist: "Ed Sheeran",
    src: `${SUPABASE_STORAGE_BASE}/sapphaire.mp3`,
    cover: "/Logo-icon.png",
  },
  {
    title: "Beggin'",
    artist: "Måneskin",
    src: `${SUPABASE_STORAGE_BASE}/beggin.mp3`,
    cover:
      "https://i1.sndcdn.com/artworks-3zuOIHWFC0aDyqIO-RaLfdQ-t500x500.jpg",
  },
];
