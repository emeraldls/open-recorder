// Credit to this project for smooth rendering on canvas: https://codepen.io/jamespeilow/pen/MWWMXPp

/*
    I was using video requestAnimationFrame callback, 
*/

import React, { useState, useEffect, useRef, useCallback } from "react";
import { main } from "../../wailsjs/go/models";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
} from "lucide-react";

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  className?: string;
  zoomPoints?: main.ZoomPoint[];
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoRef,
  onTimeUpdate,
  onDurationChange,
  onPlay,
  onPause,
  onEnded,
  className = "",
  zoomPoints,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const playerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number>(null);
  const animationFrameRef = useRef<number>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(console.error);
    }
  }, [isPlaying, videoRef]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const time = video.currentTime;
    setCurrentTime(time);
    onTimeUpdate?.(time);
  }, [videoRef, onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration);
    onDurationChange?.(video.duration);
  }, [videoRef, onDurationChange]);

  const getAverageColor = useCallback(
    (data: Uint8ClampedArray, blockSize: number = 1024) => {
      let count = 0;
      let rgb = { r: 0, g: 0, b: 0 };
      for (let i = 0, n = data.length - 4; i < n; i += blockSize * 4) {
        ++count;
        rgb.r += data[i];
        rgb.g += data[i + 1];
        rgb.b += data[i + 2];
      }
      rgb.r = Math.floor(rgb.r / count);
      rgb.g = Math.floor(rgb.g / count);
      rgb.b = Math.floor(rgb.b / count);
      return rgb;
    },
    []
  );

  const setBackgroundColour = useCallback(
    ({ r, g, b }: { r: number; g: number; b: number }) => {
      if (playerRef.current) {
        playerRef.current.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 1)`;
      }
    },
    []
  );

  const updateCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width === 0 || height === 0) return;

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);

    const { data } = ctx.getImageData(0, 0, width, height);
    const rgb = getAverageColor(data);
    setBackgroundColour(rgb);

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateCanvas);
    }
  }, [videoRef, canvasRef, getAverageColor, setBackgroundColour, isPlaying]);

  const startCanvasUpdate = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    updateCanvas();
  }, [updateCanvas]);

  const stopCanvasUpdate = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    startCanvasUpdate();
    onPlay?.();
  }, [onPlay, startCanvasUpdate]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    stopCanvasUpdate();
    onPause?.();
  }, [onPause, stopCanvasUpdate]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    onEnded?.();
  }, [onEnded]);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;

      const clampedTime = Math.max(0, Math.min(time, duration));
      video.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    },
    [videoRef, duration]
  );

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const progress = progressRef.current;
      if (!progress) return;

      const rect = progress.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const newTime = percentage * duration;

      seekTo(newTime);
    },
    [duration, seekTo]
  );

  const handleVolumeClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const volumeSlider = volumeRef.current;
      if (!volumeSlider) return;

      const rect = volumeSlider.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newVolume = Math.max(0, Math.min(1, clickX / rect.width));

      setVolume(newVolume);
      setIsMuted(false);

      const video = videoRef.current;
      if (video) {
        video.volume = newVolume;
      }
    },
    [videoRef]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume, videoRef]);

  const changeSpeed = useCallback(
    (speed: number) => {
      const video = videoRef.current;
      if (!video) return;

      video.playbackRate = speed;
      setPlaybackRate(speed);
    },
    [videoRef]
  );

  const toggleFullscreen = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    if (!isFullscreen) {
      if (player.requestFullscreen) {
        player.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [isFullscreen]);

  const skipBackward = useCallback(() => {
    seekTo(currentTime - 10);
  }, [currentTime, seekTo]);

  const skipForward = useCallback(() => {
    seekTo(currentTime + 10);
  }, [currentTime, seekTo]);

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          skipForward();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skipBackward();
          break;
      }
    },
    [togglePlay, skipForward, skipBackward]
  );

  const handleMouseMove = useCallback(() => {
    setShowControls(true);

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  const handleFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, [
    videoRef,
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePlay,
    handlePause,
    handleEnded,
  ]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [handleKeyPress, handleFullscreenChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = volume;
  }, [volume, videoRef]);

  useEffect(() => {
    if (isPlaying) {
      startCanvasUpdate();
    } else {
      stopCanvasUpdate();
    }

    return () => {
      stopCanvasUpdate();
    };
  }, [isPlaying, startCanvasUpdate, stopCanvasUpdate]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumePercentage = isMuted ? 0 : volume * 100;

  return (
    <div
      ref={playerRef}
      className={`relative p-10 rounded-lg overflow-hidden group ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video ref={videoRef} className="hidden" playsInline preload="auto" />

      <canvas ref={canvasRef} className="w-full h-auto" />

      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
          </button>
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="mb-4">
          <div
            ref={progressRef}
            className="w-full h-2 bg-white/30 rounded-full cursor-pointer relative overflow-hidden hover:h-3 transition-all"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-white rounded-full transition-all duration-150"
              style={{ width: `${progressPercentage}%` }}
            />

            <div className="absolute top-0 left-0 w-full h-2 pointer-events-none">
              {zoomPoints &&
                zoomPoints.map((point, index) => {
                  const timestamp = new Date(point.Timestamp).getTime();
                  const recordingStart =
                    new Date(point.Timestamp).getTime() -
                    (timestamp % (duration * 1000));
                  const relativeSeconds = (timestamp - recordingStart) / 1000;
                  const position =
                    duration > 0 ? (relativeSeconds / duration) * 100 : 0;

                  return (
                    <div
                      key={index}
                      className="absolute w-1 h-4 bg-yellow-400 transform -translate-x-1/2 -translate-y-1"
                      style={{
                        left: `${Math.max(0, Math.min(100, position))}%`,
                      }}
                      title={`Zoom point at ${formatTime(relativeSeconds)}`}
                    />
                  );
                })}
            </div>
          </div>
        </div>

        <div className="absolute right-4 bottom-16 text-white text-sm font-medium">
          <span className="text-current">{formatTime(currentTime)}</span>
          <span className="text-white/70"> / </span>
          <span className="text-white/70">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play
                  className="w-5 h-5 text-white ml-0.5"
                  fill="currentColor"
                />
              )}
            </button>

            <button
              onClick={skipBackward}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
            >
              <SkipBack className="w-4 h-4 text-white" />
            </button>

            <button
              onClick={skipForward}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
            >
              <SkipForward className="w-4 h-4 text-white" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-white" />
                ) : volume > 0.7 ? (
                  <Volume2 className="w-4 h-4 text-white" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
              </button>
              <div
                ref={volumeRef}
                className="w-20 h-2 bg-white/30 rounded-full cursor-pointer relative overflow-hidden hover:h-3 transition-all"
                onClick={handleVolumeClick}
              >
                <div
                  className="h-full bg-white rounded-full transition-all duration-150"
                  style={{ width: `${volumePercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {[0.5, 0.75, 1, 1.5, 2].map((speed) => (
                <button
                  key={speed}
                  onClick={() => changeSpeed(speed)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    playbackRate === speed
                      ? "bg-white text-black"
                      : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
