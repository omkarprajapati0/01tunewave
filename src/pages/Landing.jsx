import { useState } from "react";
import { Link } from "react-router-dom";
import logoIcon from "../assets/images/Logo-icon.png";

export default function Landing() {
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const heroImageSrc =
    "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1100&q=80";

  const featureCards = [
    {
      icon: "♪",
      title: "Ad-free listening",
      description: "Stream continuously with no ad breaks between tracks.",
    },
    {
      icon: "↻",
      title: "Unlimited skips",
      description: "Jump to your favorite songs instantly, anytime you want.",
    },
    {
      icon: "▶",
      title: "YouTube fallback",
      description:
        "If a preview is missing, TuneWave auto-finds a playable version.",
    },
    {
      icon: "◎",
      title: "Curated genres",
      description: "English, Bollywood, and Marathi collections ready to play.",
    },
  ];

  const heroStats = [
    { value: "100K+", label: "tracks searchable" },
    { value: "0", label: "payment steps" },
    { value: "24/7", label: "listening energy" },
  ];

  const faqItems = [
    {
      question: "Is TuneWave really free?",
      answer:
        "Yes. TuneWave is fully free for listeners. No subscription and no payment wall.",
    },
    {
      question: "Do I need a credit card to start?",
      answer:
        "No. Just sign in and start listening. There is no card requirement.",
    },
    {
      question: "Can I play songs that lack Spotify previews?",
      answer:
        "Yes. TuneWave can switch to YouTube playback when Spotify preview audio is unavailable.",
    },
  ];

  const discoveryPanels = [
    {
      title: "Made for your mood",
      text: "Jump between calm mornings, gym sessions, and late-night chill sets in one tap.",
    },
    {
      title: "Where fans meet artists",
      text: "Discover rising voices and replay moments that trend across music culture.",
    },
  ];

  const spotlightCards = [
    {
      src: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80",
      alt: "Singer performing on stage",
      caption: "Live moments, replayed in your playlists.",
    },
    {
      src: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80",
      alt: "Concert crowd with lights",
      caption: "From underground scenes to chart-breaking hits.",
    },
    {
      src: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
      alt: "DJ mixing on stage",
      caption: "Every beat, ready when you are.",
    },
  ];

  return (
    <div className="tw-landing-page">
      <header className="tw-landing-nav">
        <Link to="/" className="tw-brand" aria-label="TuneWave home">
          {!logoLoadFailed ? (
            <img
              src={logoIcon}
              alt="TuneWave logo"
              className="tw-brand-logo"
              onError={() => setLogoLoadFailed(true)}
            />
          ) : (
            <span className="tw-brand-text">TuneWave</span>
          )}
        </Link>

        <nav className="tw-nav-links" aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
        </nav>

        <div className="tw-nav-actions">
          <Link to="/login" className="tw-link-muted">
            Explore
          </Link>
          <Link to="/login" className="tw-pill-button tw-pill-dark">
            Log in
          </Link>
        </div>
      </header>

      <main className="tw-landing-main">
        <section className="tw-hero" id="top">
          <div className="tw-hero-content">
            <div>
              <p className="tw-hero-kicker">Music for everyone</p>
              <h1>Listen free. Stay in the vibe.</h1>
              <p className="tw-hero-copy">
                Inspired by the best music experiences, rebuilt for TuneWave. No
                premium upsell. No checkout. Just powerful search, rich
                discovery, and nonstop playback.
              </p>

              <div className="tw-hero-actions">
                <Link to="/login" className="tw-pill-button tw-pill-light">
                  Start listening free
                </Link>
                <Link to="/login" className="tw-pill-button tw-pill-outline">
                  Browse songs
                </Link>
              </div>

              <div className="tw-hero-tags" aria-label="TuneWave highlights">
                <span>Ad-free</span>
                <span>Unlimited skips</span>
                <span>No payment</span>
              </div>

              <div className="tw-hero-stats" aria-label="TuneWave stats">
                {heroStats.map((item) => (
                  <div key={item.label} className="tw-hero-stat">
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <aside className="tw-hero-side" aria-label="Now playing preview">
              <div className="tw-hero-disk-scene" aria-hidden="true">
                <div className="tw-hero-disk">
                  <img
                    src={heroImageSrc}
                    alt=""
                    className="tw-hero-disk-label"
                    loading="lazy"
                  />
                  <span className="tw-hero-disk-hole"></span>
                </div>
              </div>

              <div className="tw-hero-mockup">
                <div className="tw-mockup-header">Now playing</div>
                <div className="tw-mockup-track">
                  <p>Night Drive</p>
                  <span>Synthwave Collective</span>
                </div>
                <div className="tw-mockup-track">
                  <p>Golden Hour Loops</p>
                  <span>Chill Bloom</span>
                </div>
                <div className="tw-mockup-track">
                  <p>Bollywood Heatmix</p>
                  <span>TuneWave Picks</span>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="tw-feature-grid" id="features">
          {featureCards.map((item) => (
            <article key={item.title} className="tw-feature-card">
              <div className="tw-feature-icon" aria-hidden="true">
                {item.icon}
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </section>

        <section
          className="tw-social-proof"
          aria-label="Popular listening contexts"
        >
          <p>Popular right now:</p>
          <div>
            <span>Gym Mode</span>
            <span>Late Night Drive</span>
            <span>Bollywood Rewinds</span>
            <span>Lo-fi Focus</span>
          </div>
        </section>

        <section
          className="tw-discovery-strip"
          aria-label="Discovery highlights"
        >
          {discoveryPanels.map((item) => (
            <article key={item.title} className="tw-discovery-panel">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </section>

        <section className="tw-spotlight" aria-label="Culture spotlight">
          <div className="tw-spotlight-head">
            <p className="tw-hero-kicker">Culture moves here</p>
            <h2>Be there when the next big sound drops.</h2>
          </div>

          <div className="tw-spotlight-grid">
            {spotlightCards.map((card) => (
              <figure key={card.src} className="tw-spotlight-card">
                <img src={card.src} alt={card.alt} loading="lazy" />
                <figcaption>{card.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="tw-faq" id="faq">
          <h2>Questions?</h2>
          {faqItems.map((item) => (
            <details key={item.question} className="tw-faq-item">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>
      </main>

      <footer className="tw-landing-footer">
        <p>TuneWave</p>
        <Link to="/about">About</Link>
      </footer>
    </div>
  );
}
