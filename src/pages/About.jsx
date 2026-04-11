import { Link } from "react-router-dom";

const highlights = [
  {
    title: "Smart discovery",
    text: "Find songs quickly with clean search, category browsing, and artist-first exploration.",
  },
  {
    title: "Playlist control",
    text: "Create personal playlists, organize tracks, and keep your listening flow in one place.",
  },
  {
    title: "Fallback playback",
    text: "When previews are limited, TuneWave can recover playable sources to keep music running.",
  },
];

export default function About() {
  return (
    <div className="standalone-page-shell">
      <div className="standalone-page-panel" style={{ maxWidth: "980px" }}>
        <p
          style={{
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: "0.78rem",
            color: "#c4b5fd",
            marginBottom: "8px",
            fontWeight: 700,
          }}
        >
          About TuneWave
        </p>
        <h1 className="standalone-page-title" style={{ marginBottom: "12px" }}>
          Music experience without clutter
        </h1>
        <p className="standalone-page-subtitle" style={{ maxWidth: "72ch" }}>
          TuneWave is built for focused listening. It brings together curated
          collections, search, playlists, and smooth playback in a single modern
          interface. The goal is simple: make finding and playing songs feel
          effortless.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
            marginTop: "22px",
          }}
        >
          {highlights.map((item) => (
            <article
              key={item.title}
              style={{
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                padding: "14px",
              }}
            >
              <h2 style={{ fontSize: "1rem", marginBottom: "6px" }}>
                {item.title}
              </h2>
              <p
                style={{
                  color: "#d1d5db",
                  fontSize: "0.92rem",
                  lineHeight: 1.6,
                }}
              >
                {item.text}
              </p>
            </article>
          ))}
        </div>

        <div
          style={{
            marginTop: "22px",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/homepage"
            style={{
              borderRadius: "999px",
              padding: "10px 16px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.9rem",
            }}
          >
            Go to Home
          </Link>
          <Link
            to="/help"
            style={{
              borderRadius: "999px",
              padding: "10px 16px",
              border: "1px solid rgba(255,255,255,0.24)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            Need help?
          </Link>
        </div>
      </div>
    </div>
  );
}
