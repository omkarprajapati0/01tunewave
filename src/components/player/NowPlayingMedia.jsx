import { useEffect, useRef } from "react";
import { usePlayer } from "../../context/PlayerContext";

export default function NowPlayingMedia({
  song,
  fallbackImage = "",
  showVideo,
  onImageError,
  onCloseVideo,
}) {
  const mountRef = useRef(null);
  const { isCurrentSongFromYouTube, setYoutubeMountElement } = usePlayer();

  useEffect(() => {
    if (showVideo && isCurrentSongFromYouTube && mountRef.current) {
      setYoutubeMountElement(mountRef.current);
      return;
    }

    setYoutubeMountElement(null);
  }, [showVideo, isCurrentSongFromYouTube, setYoutubeMountElement]);

  if (showVideo && isCurrentSongFromYouTube) {
    return (
      <div style={{ position: "relative" }}>
        <div
          ref={mountRef}
          className="now-playing-cover"
          style={{
            pointerEvents: "none",
            userSelect: "none",
            cursor: "default",
          }}
        />
        <button
          type="button"
          onClick={onCloseVideo}
          aria-label="Close video"
          title="Close video"
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            width: "30px",
            height: "30px",
            borderRadius: "999px",
            border: "none",
            background: "rgba(0, 0, 0, 0.72)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            lineHeight: 1,
          }}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
    );
  }

  return (
    <img
      src={song?.cover || fallbackImage}
      alt="Now Playing Cover"
      className="now-playing-cover"
      onError={onImageError}
      style={{
        pointerEvents: "none",
        userSelect: "none",
        cursor: "default",
      }}
    />
  );
}
