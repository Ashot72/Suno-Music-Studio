"use client";

import { useRef, useState, useEffect, useCallback } from "react";

type StyledAudioPlayerProps = {
  src: string;
  preload?: "none" | "metadata" | "auto";
  /** When set, show a download button that saves the file with this name (e.g. "track.mp3"). */
  downloadFilename?: string;
  className?: string;
  "aria-label"?: string;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StyledAudioPlayer({
  src,
  preload = "metadata",
  downloadFilename,
  className = "",
  "aria-label": ariaLabel = "Audio player",
}: StyledAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isSeekingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [volume, setVolume] = useState(1);
  const [volumeExpanded, setVolumeExpanded] = useState(false);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play().catch(() => setPlaying(false));
  }, [playing]);

  const handleTimeUpdate = useCallback(() => {
    if (isSeekingRef.current || !audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setLoaded(true);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  const handlePlay = useCallback(() => setPlaying(true), []);
  const handlePause = useCallback(() => setPlaying(false), []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (audioRef.current && Number.isFinite(value)) {
      isSeekingRef.current = true;
      audioRef.current.currentTime = value;
      setCurrentTime(value);
    }
  }, []);

  const handleSeeked = useCallback(() => {
    isSeekingRef.current = false;
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (audioRef.current && Number.isFinite(value)) {
      audioRef.current.volume = value;
      setVolume(value);
    }
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
  }, [volume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.addEventListener("timeupdate", handleTimeUpdate);
    el.addEventListener("loadedmetadata", handleLoadedMetadata);
    el.addEventListener("ended", handleEnded);
    el.addEventListener("play", handlePlay);
    el.addEventListener("pause", handlePause);
    el.addEventListener("seeked", handleSeeked);
    return () => {
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("loadedmetadata", handleLoadedMetadata);
      el.removeEventListener("ended", handleEnded);
      el.removeEventListener("play", handlePlay);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("seeked", handleSeeked);
    };
  }, [handleTimeUpdate, handleLoadedMetadata, handleEnded, handlePlay, handlePause, handleSeeked]);

  return (
    <div
      className={`flex flex-nowrap items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2 ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      <audio ref={audioRef} src={src} preload={preload} className="sr-only" />
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 transition-colors hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M8 5v14l11-7L8 5z" />
          </svg>
        )}
      </button>
      <div className="flex min-w-[180px] flex-1 items-center gap-2">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className={`audio-progress h-1.5 min-w-[80px] flex-1 cursor-pointer accent-blue-500${playing ? " audio-playing" : ""}`}
          aria-label="Seek"
        />
        <span className="shrink-0 text-xs tabular-nums text-gray-500">
          {formatTime(currentTime)} / {loaded ? formatTime(duration) : "–:––"}
        </span>
      </div>
      <div className="relative flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => setVolumeExpanded((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 transition-colors hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]"
          aria-label={volume === 0 ? "Unmute" : "Volume"}
          title="Volume"
        >
          {volume === 0 ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
          ) : volume < 0.5 ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </button>
        {volumeExpanded && (
          <div className="absolute right-full top-1/2 mr-1 flex -translate-y-1/2 items-center gap-1 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-2 py-1.5">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={handleVolumeChange}
              className="audio-progress h-1.5 w-20 cursor-pointer accent-blue-500"
              aria-label="Volume"
            />
          </div>
        )}
      </div>
      {downloadFilename && (
        <a
          href={src}
          download={downloadFilename}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 transition-colors hover:border-blue-600/50 hover:bg-blue-950/30 hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f0f0f]"
          aria-label="Download"
          title="Download"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      )}
    </div>
  );
}
