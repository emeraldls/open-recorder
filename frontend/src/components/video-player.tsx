import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EventsOn, EventsOff } from "../../wailsjs/runtime";
import {
  StopRecording,
  IsRecording,
  StartRecording,
  SaveFile,
} from "../../wailsjs/go/main/App";
import { Play, Square, Download, Circle } from "lucide-react";

export const VideoPlayer = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [videoData, setVideoData] = useState<ArrayBuffer | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  useEffect(() => {
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

          console.log("Video ref", videoRef.current);

          if (videoRef.current) {
            const blob = new Blob([arrayBuffer], { type: "video/mp4" });
            const url = URL.createObjectURL(blob);
            console.log("url: ", url);
            videoRef.current.src = url;
          }
        }
      }, 800);
    });

    EventsOn("recording_started", () => {
      setIsRecording(true);
      setVideoData(null);
    });

    EventsOn("recording_stopped", () => {
      setIsRecording(false);
    });

    return () => {
      EventsOff("recording_started");
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
    try {
      await StartRecording();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
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
      await SaveFile(array);
    } catch (error) {
      console.error("Failed to save video:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
            Screen Recorder
          </h1>
          <p className="text-lg text-muted-foreground font-medium">
            Capture your screen with professional quality
          </p>
        </div>

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
          )}
        </div>

        <Card
          className={`overflow-hidden shadow-2xl border-0 bg-card/50 backdrop-blur-sm ${
            videoData && (!isRecording || !isProcessing) ? "block" : "hidden"
          }`}
        >
          <CardContent className="p-0">
            <div className="relative">
              <video
                ref={videoRef}
                controls
                autoPlay
                className="w-full h-auto rounded-lg bg-black"
                style={{ minHeight: "300px" }}
              />

              <div className="absolute top-4 right-4">
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
