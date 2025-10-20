import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoPlayer } from "@/components/video-player";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import {
  StopRecording,
  IsRecording,
  StartRecording,
  GetCaptureDevices,
  GetSelectedDevice,
  SetSelectedDevice,
  GetZoomPoints,
  SaveFileWithFPS,
} from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";
import { Play, Square, Download, Circle, Monitor } from "lucide-react";

export const Recorder = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [videoData, setVideoData] = useState<ArrayBuffer | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const [captureDevices, setCaptureDevices] = useState<main.CaptureDevice[]>(
    []
  );
  const [selectedDevice, setSelectedDeviceState] = useState<number | null>(
    null
  );
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(true);

  // Video editing states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [zoomPoints, setZoomPoints] = useState<main.ZoomPoint[]>([]);
  const [selectedFPS, setSelectedFPS] = useState<number>(30);

  // Refs
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const loadZoomPoints = async () => {
    try {
      const points = await GetZoomPoints();
      setZoomPoints(points);
      console.log("Loaded zoom points:", points);
    } catch (error) {
      console.error("Failed to load zoom points:", error);
    }
  };

  const base64ToArrayBuffer = (base64: string): ArrayBuffer | null => {
    try {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.error("Error converting base64 to ArrayBuffer:", error);
      return null;
    }
  };

  const processVideoData = (data: any): ArrayBuffer | null => {
    console.log(
      "Processing video data:",
      typeof data,
      data?.length || data?.byteLength
    );

    if (typeof data === "string") {
      return base64ToArrayBuffer(data);
    } else if (data instanceof ArrayBuffer) {
      return data;
    } else if (data?.buffer instanceof ArrayBuffer) {
      return data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      );
    } else if (Array.isArray(data) || data instanceof Uint8Array) {
      const uint8Array = new Uint8Array(data);
      return uint8Array.buffer;
    } else {
      console.error("Unknown video data format:", data);
      return null;
    }
  };

  const loadCaptureDevices = async () => {
    try {
      setIsLoadingDevices(true);
      const devices = await GetCaptureDevices();
      console.log(devices);
      setCaptureDevices(devices);

      const currentDevice = await GetSelectedDevice();
      setSelectedDeviceState(currentDevice);
    } catch (error) {
      console.error("Failed to load capture devices:", error);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const handleDeviceChange = async (deviceIndex: number) => {
    try {
      await SetSelectedDevice(deviceIndex);
      setSelectedDeviceState(deviceIndex);
    } catch (error) {
      console.error("Failed to set selected device:", error);
    }
  };

  useEffect(() => {
    loadCaptureDevices();

    IsRecording()
      .then((recording: boolean) => {
        if (recording) {
          setIsRecording(true);
        }
      })
      .catch((error: Error) => {
        console.error("Failed to check recording status:", error);
      });

    EventsOn("recording_complete", (data: any) => {
      console.log("Recording complete, received video data");
      setIsProcessing(true);

      setTimeout(() => {
        const arrayBuffer = processVideoData(data);

        console.log("Array Buffer", arrayBuffer);
        if (arrayBuffer) {
          setVideoData(arrayBuffer);
          setRecordingTime(0);
          setIsRecording(false);
          setIsProcessing(false);

          const blob = new Blob([arrayBuffer], { type: "video/mp4" });
          const url = URL.createObjectURL(blob);

          if (hiddenVideoRef.current) {
            hiddenVideoRef.current.src = url;
            hiddenVideoRef.current.onloadedmetadata = () => {
              if (hiddenVideoRef.current) {
                setDuration(hiddenVideoRef.current.duration);
                loadZoomPoints();
              }
            };
          }

          console.log("Video setup complete");
        }
      }, 800);
    });

    EventsOn("recording_started", () => {
      setIsRecording(true);
      setVideoData(null);
    });

    EventsOn("recording_preparing", () => {
      console.log("Backend is preparing to record");
    });

    EventsOn("recording_stopped", () => {
      setIsRecording(false);
    });

    return () => {
      EventsOff("recording_started");
      EventsOff("recording_preparing");
      EventsOff("recording_stopped");
      EventsOff("recording_complete");
    };
  }, []);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleStartRecording = async (): Promise<void> => {
    if (!selectedDevice) return;

    if (typeof selectedDevice == "string" && selectedDevice == "") {
      return;
    }

    try {
      setVideoData(null);

      StartRecording()
        .then(() => {
          setIsRecording(true);
        })
        .catch((error) => {
          console.error("Failed to start recording:", error);
        });
    } catch (error) {
      console.error("Failed to prepare recording:", error);
    }
  };

  const handleStopRecording = async (): Promise<void> => {
    try {
      setIsProcessing(true);
      await StopRecording();
      setIsRecording(false);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsRecording(false);
      setIsProcessing(false);
    }
  };

  const saveVideo = async () => {
    if (!videoData) {
      return;
    }

    try {
      const uint8Array = new Uint8Array(videoData);
      const array = Array.from(uint8Array);

      await SaveFileWithFPS(array, selectedFPS);

      console.log(`Video saved with ${selectedFPS}fps`);
    } catch (error) {
      console.error("Failed to save video:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Open Recorder
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Choose what you'd like to record
          </p>
        </div>

        <Card className="mb-8 bg-card/50 backdrop-blur-sm border border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Monitor className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select Capture Device
                </label>
                {isLoadingDevices ? (
                  <div className="text-sm text-muted-foreground">
                    Loading devices...
                  </div>
                ) : (
                  <select
                    defaultValue={selectedDevice!}
                    onChange={(e) => handleDeviceChange(Number(e.target.value))}
                    disabled={isRecording || isProcessing}
                    className={`
                      w-full px-3 py-2 rounded-md border border-border bg-background
                      text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <option value="" selected>
                      select device
                    </option>
                    {captureDevices.map((device) => (
                      <option key={device.index} value={device.index}>
                        {device.name} (Device {device.index})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-4 mb-12">
          {!isRecording ? (
            <Button
              onClick={handleStartRecording}
              disabled={isProcessing}
              size="lg"
              className={`
                h-14 px-8 text-lg font-semibold rounded-full transition-all duration-200
                bg-primary hover:bg-primary/90 text-primary-foreground
                hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              `}
            >
              <Circle className="w-5 h-5 mr-2 fill-current" />
              Start Recording
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="text-2xl font-bold text-red-500">
                ● REC {Math.floor(recordingTime / 60)}:
                {(recordingTime % 60).toString().padStart(2, "0")}
              </div>
              <Button
                onClick={handleStopRecording}
                disabled={isProcessing}
                size="lg"
                variant="secondary"
                className={`
                  h-14 px-8 text-lg font-semibold rounded-full transition-all duration-200
                  hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                `}
              >
                <Square className="w-5 h-5 mr-2 fill-current" />
                Stop Recording
              </Button>
            </div>
          )}
        </div>

        <Card
          className={`overflow-hidden shadow-2xl border-0 bg-card/50 backdrop-blur-sm ${
            videoData && !isRecording && !isProcessing ? "block" : "hidden"
          }`}
        >
          <CardContent className="p-0">
            <div className="relative">
              <VideoPlayer
                videoRef={hiddenVideoRef}
                onTimeUpdate={(time) => {
                  setCurrentTime(time);
                }}
                onDurationChange={setDuration}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="w-full"
                zoomPoints={zoomPoints}
              />

              <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                <select
                  value={selectedFPS}
                  onChange={(e) => setSelectedFPS(Number(e.target.value))}
                  className={`
                    px-2 py-1 text-xs rounded border border-border bg-background/90
                    text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50
                    backdrop-blur-sm
                  `}
                >
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                </select>

                <Button
                  onClick={saveVideo}
                  size="sm"
                  className={`
                      bg-background/90 hover:bg-background text-foreground
                      backdrop-blur-sm border border-border/50 rounded-full
                      transition-all duration-200 hover:scale-105 active:scale-95
                      shadow-lg hover:shadow-xl
                    `}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {!videoData && !isRecording && !isProcessing && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              Your recorded video will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
