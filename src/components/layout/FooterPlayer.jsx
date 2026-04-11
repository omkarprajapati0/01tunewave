import { useState, useRef, useCallback } from "react";
import { usePlayer } from "../../context/PlayerContext";
import AddToPlaylist from "../AddToPlaylist";
import YouTubePlayer, { getVideoId } from "../player/YouTubePlayer";

export default function FooterPlayer() {
  const {
    currentSong,
    playing,
    progress,
    currentTime,
    duration,
    volume,
    isShuffle,
    isRepeat,
    formatTime,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
    changeVolume,
    toggleShuffle,
    toggleRepeat,
    isCurrentSongFromYouTube,
    youtubeMountElement,
  } = usePlayer();

  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const progressRef = useRef(null);

  // Calculate seek percentage from mouse position - MUST be before early return
  const calculatePercent = useCallback((clientX) => {
    if (!progressRef.current) return 0;
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const width = rect.width;
    let percent = (clickX / width) * 100;
    // Clamp between 0 and 100
    percent = Math.max(0, Math.min(100, percent));
    return percent;
  }, []);

  // Handle mouse move while dragging - MUST be before early return
  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const percent = calculatePercent(e.clientX);
      seekTo(percent);
    },
    [isDragging, calculatePercent, seekTo],
  );

  // Handle mouse up to stop dragging - MUST be before early return
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Early return after all hooks are defined
  if (!currentSong) return null;

  // Get YouTube video ID if this is a YouTube song
  const youtubeVideoId = isCurrentSongFromYouTube
    ? getVideoId(currentSong)
    : null;

  // Handle click on progress bar
  const handleProgressClick = (e) => {
    if (isDragging) return; // Don't handle click if we were dragging
    const percent = calculatePercent(e.clientX);
    seekTo(percent);
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const percent = calculatePercent(e.clientX);
    seekTo(percent);
  };

  // Add/remove global mouse event listeners for dragging
  const handleMouseEnter = () => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseLeave = () => {
    if (!isDragging) {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
  };

  return (
    <>
      {/* Render YouTube player when playing YouTube songs */}
      {isCurrentSongFromYouTube && youtubeVideoId && (
        <YouTubePlayer
          videoId={youtubeVideoId}
          isPlaying={playing}
          onEnded={nextTrack}
          containerElement={youtubeMountElement}
        />
      )}

      <footer className="footer-player">
        <div className="player">
          <img src={currentSong.cover} alt="Cover" className="player-cover" />

          <div className="player-info">
            <div className="player-title">{currentSong.title}</div>
            <div className="player-artist">{currentSong.artist}</div>
          </div>

          <div className="controls">
            <button onClick={prevTrack} title="Previous">
              <i className="fas fa-step-backward"></i>
            </button>
            <button
              onClick={togglePlay}
              className="play-btn"
              title="Play/Pause"
            >
              <i className={`fas fa-${playing ? "pause" : "play"}`}></i>
            </button>
            <button onClick={nextTrack} title="Next">
              <i className="fas fa-step-forward"></i>
            </button>
          </div>

          <div
            className="progress-container"
            ref={progressRef}
            onClick={handleProgressClick}
            onMouseDown={handleMouseDown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: isDragging ? "grabbing" : "pointer" }}
          >
            <div
              className="progress-bar"
              style={{ width: `${progress}%` }}
            ></div>
            {/* Draggable handle */}
            <div
              className="progress-handle"
              style={{
                left: `${progress}%`,
              }}
            ></div>
          </div>

          <div className="player-time">
            <span>{formatTime(currentTime)}</span> /{" "}
            <span>{formatTime(duration)}</span>
          </div>

          <div className="extra-controls">
            <button
              onClick={toggleShuffle}
              title="Shuffle"
              style={{ opacity: isShuffle ? 1 : 0.5 }}
            >
              <i className="fas fa-random"></i>
            </button>
            <button
              onClick={toggleRepeat}
              title="Repeat"
              style={{ opacity: isRepeat ? 1 : 0.5 }}
            >
              <i className="fas fa-redo"></i>
            </button>

            <button
              onClick={() => setShowAddToPlaylist(true)}
              title="Add to Playlist"
              style={{ marginLeft: "10px", opacity: 1 }}
            >
              <i className="fas fa-plus-square"></i>
            </button>

            <div className="volume-control">
              <i className="fas fa-volume-low"></i>
              <input
                type="range"
                className="volume-slider"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>
      </footer>

      {showAddToPlaylist && (
        <AddToPlaylist
          song={currentSong}
          onClose={() => setShowAddToPlaylist(false)}
        />
      )}
    </>
  );
}
