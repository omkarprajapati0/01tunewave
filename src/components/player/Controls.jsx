import { usePlayer } from "../../context/PlayerContext";

const Controls = ({
  showProgress = true,
  showVolume = true,
  compact = false,
}) => {
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
  } = usePlayer();

  if (!currentSong) return null;

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percent = (clickX / width) * 100;
    seekTo(percent);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={prevTrack}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Previous"
        >
          <i className="fas fa-step-backward"></i>
        </button>
        <button
          onClick={togglePlay}
          className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors"
          title="Play/Pause"
        >
          <i className={`fas fa-${playing ? "pause" : "play"}`}></i>
        </button>
        <button
          onClick={nextTrack}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Next"
        >
          <i className="fas fa-step-forward"></i>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 w-full">
      {/* Song Info */}
      <div className="flex items-center gap-3 mb-4">
        <img
          src={currentSong.cover}
          alt={currentSong.title}
          className="w-12 h-12 object-cover rounded"
        />
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{currentSong.title}</p>
          <p className="text-gray-400 text-sm truncate">{currentSong.artist}</p>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={toggleShuffle}
          className={`p-2 transition-colors ${isShuffle ? "text-green-500" : "text-gray-400 hover:text-white"}`}
          title="Shuffle"
        >
          <i className="fas fa-random"></i>
        </button>

        <button
          onClick={prevTrack}
          className="p-2 text-gray-300 hover:text-white transition-colors"
          title="Previous"
        >
          <i className="fas fa-step-backward text-lg"></i>
        </button>

        <button
          onClick={togglePlay}
          className="p-4 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors"
          title="Play/Pause"
        >
          <i className={`fas fa-${playing ? "pause" : "play"} text-xl`}></i>
        </button>

        <button
          onClick={nextTrack}
          className="p-2 text-gray-300 hover:text-white transition-colors"
          title="Next"
        >
          <i className="fas fa-step-forward text-lg"></i>
        </button>

        <button
          onClick={toggleRepeat}
          className={`p-2 transition-colors ${isRepeat ? "text-green-500" : "text-gray-400 hover:text-white"}`}
          title="Repeat"
        >
          <i className="fas fa-redo"></i>
        </button>
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="mb-4">
          <div
            className="h-2 bg-gray-700 rounded-full cursor-pointer relative"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Volume Control */}
      {showVolume && (
        <div className="flex items-center gap-3">
          <i className="fas fa-volume-low text-gray-400"></i>
          <input
            type="range"
            className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => changeVolume(parseFloat(e.target.value))}
          />
          <i className="fas fa-volume-high text-gray-400"></i>
        </div>
      )}
    </div>
  );
};

export default Controls;
