import { Link } from "react-router-dom";

const quickFixes = [
  "Refresh the page if songs stop loading.",
  "Sign out and log in again if account data looks outdated.",
  "Check internet stability for playback and search issues.",
  "Use a supported modern browser for best performance.",
];

export default function Help() {
  return (
    <div className="standalone-page-shell">
      <div className="standalone-page-panel" style={{ maxWidth: "980px" }}>
        <h1 className="standalone-page-title">Help Center</h1>
        <p className="standalone-page-subtitle" style={{ maxWidth: "68ch" }}>
          If something is not working right, start with these quick fixes. If
          the issue remains, contact support with clear details so we can
          resolve it faster.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "12px",
            marginTop: "18px",
          }}
        >
          <section
            style={{
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              padding: "14px",
            }}
          >
            <h2 style={{ fontSize: "1rem", marginBottom: "8px" }}>
              Quick fixes
            </h2>
            <ul
              style={{ paddingLeft: "18px", color: "#d1d5db", lineHeight: 1.7 }}
            >
              {quickFixes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section
            style={{
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              padding: "14px",
            }}
          >
            <h2 style={{ fontSize: "1rem", marginBottom: "8px" }}>
              Contact support
            </h2>
            <p
              style={{ color: "#d1d5db", lineHeight: 1.6, marginBottom: "8px" }}
            >
              Email: support@tunewave.com
            </p>
            <p style={{ color: "#d1d5db", lineHeight: 1.6 }}>
              Include device, browser, and a short issue summary.
            </p>
          </section>
        </div>

        <div
          style={{
            marginTop: "18px",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/about"
            style={{
              borderRadius: "999px",
              padding: "10px 16px",
              border: "1px solid rgba(255,255,255,0.24)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            About TuneWave
          </Link>
          <Link
            to="/homepage"
            style={{
              borderRadius: "999px",
              padding: "10px 16px",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.9rem",
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
