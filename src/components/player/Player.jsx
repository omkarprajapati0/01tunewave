import { usePlayer } from "../../context/PlayerContext";
import YouTubePlayer, { getVideoId } from "./YouTubePlayer";

export default function Player() {
  const {
    currentSong,
    playing,
    togglePlay,
    nextTrack,
    prevTrack,
    isShuffle,
    setIsShuffle,
    isRepeat,
    setIsRepeat,
    volume,
    changeVolume,
    progress,
    seekTo,
    isCurrentSongFromYouTube,
  } = usePlayer();

  if (!currentSong) return null;

  // Get YouTube video ID if this is a YouTube song
  const youtubeVideoId = isCurrentSongFromYouTube
    ? getVideoId(currentSong)
    : null;

  return (
    <>
      {/* Render YouTube player when playing YouTube songs */}
      {isCurrentSongFromYouTube && youtubeVideoId && (
        <YouTubePlayer
          videoId={youtubeVideoId}
          isPlaying={playing}
          onEnded={nextTrack}
        />
      )}

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-lg text-white rounded-full px-6 py-3 flex items-center gap-4 w-[90%] max-w-4xl">
        <img
          src={currentSong.cover}
          className="h-14 w-14 rounded-full object-cover"
          alt={currentSong.title}
        />

        <div className="flex-1">
          <p className="font-semibold">{currentSong.title}</p>
          <p className="text-sm text-gray-300">{currentSong.artist}</p>

          <div
            className="h-1 bg-gray-600 rounded mt-1 cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seekTo(((e.clientX - rect.left) / rect.width) * 100);
            }}
          >
            <div
              className="h-full bg-gold rounded"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button onClick={() => setIsShuffle(!isShuffle)}>🔀</button>
        <button onClick={prevTrack}>⏮</button>
        <button onClick={togglePlay}>{playing ? "⏸" : "▶️"}</button>
        <button onClick={nextTrack}>⏭</button>
        <button onClick={() => setIsRepeat(!isRepeat)}>🔁</button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => changeVolume(e.target.value)}
          className="w-24"
        />
      </div>
    </>
  );
}
