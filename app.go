package main

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"io"
	"log"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-vgo/robotgo"
	"github.com/google/uuid"

	hook "github.com/robotn/gohook"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Resolution constants
const (
	Resolution720p  = "1280x720"
	Resolution1080p = "1920x1080"
	Resolution1440p = "2560x1440"
	Resolution4K    = "3840x2160"
)

/*
	I need to build a custom mouse graphic,

	i know the mouse movements as it changes
*/

type Mouse struct {
	x   int
	y   int
	img image.RGBA
}

func (m *Mouse) Draw() {

}

type ZoomPoint struct {
	X         int
	Y         int
	Timestamp time.Time
}

type CaptureDevice struct {
	Index int    `json:"index"`
	Name  string `json:"name"`
}

type ResolutionDimensions struct {
	Width  int
	Height int
}

// parseResolution converts a resolution string like "1920x1080" to width and height
func parseResolution(resolution string) (ResolutionDimensions, error) {
	parts := strings.Split(resolution, "x")
	if len(parts) != 2 {
		return ResolutionDimensions{}, fmt.Errorf("invalid resolution format: %s", resolution)
	}

	width, err := strconv.Atoi(parts[0])
	if err != nil {
		return ResolutionDimensions{}, fmt.Errorf("invalid width in resolution: %s", parts[0])
	}

	height, err := strconv.Atoi(parts[1])
	if err != nil {
		return ResolutionDimensions{}, fmt.Errorf("invalid height in resolution: %s", parts[1])
	}

	return ResolutionDimensions{Width: width, Height: height}, nil
}

// GetResolutionDimensions returns the width and height for the app's current resolution
func (a *App) GetResolutionDimensions() (ResolutionDimensions, error) {
	return parseResolution(a.resolution)
}

type App struct {
	ctx           context.Context
	resolution    string
	isRecording   bool
	stopRecording chan bool
	recordingMux  sync.Mutex
	ffmpegCmd     *exec.Cmd
	stdin         io.WriteCloser
	includeScreen bool
	includeCamera bool
	includeAudio  bool
	isPreview     bool
	stopPreview   chan bool
	previewMux    sync.Mutex
	mousePos      chan struct {
		x int
		y int
	}
	mouseCapture       bool
	mouseMux           sync.Mutex
	zoomPoints         []ZoomPoint
	zoomPointsMux      sync.Mutex
	recordingStartTime time.Time
	selectedDevice     int
	deviceMux          sync.Mutex
}

func NewApp() *App {
	return &App{
		mousePos: make(chan struct {
			x int
			y int
		}, 10),
		resolution: Resolution1080p,
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// func (a *App) GetScreens() {

// 	n := screenshot.NumActiveDisplays()

// 	for i := 0; i < n; i++ {
// 		bounds := screenshot.GetDisplayBounds(i)

// 		img, err := screenshot.CaptureRect(bounds)
// 		if err != nil {
// 			panic(err)
// 		}
// 		fileName := fmt.Sprintf("%d_%dx%d.png", i, bounds.Dx(), bounds.Dy())
// 		file, _ := os.Create(fileName)
// 		defer file.Close()
// 		png.Encode(file, img)

// 		fmt.Printf("#%d : %v \"%s\"\n", i, bounds, fileName)
// 	}

// 	return

// 	// Configure codec
// 	x264Params, err := x264.NewParams()
// 	if err != nil {
// 		log.Fatalf("failed to create x264 params: %v", err)
// 	}
// 	x264Params.Preset = x264.PresetMedium
// 	x264Params.BitRate = 1_000_000

// 	codecSelector := mediadevices.NewCodecSelector(
// 		mediadevices.WithVideoEncoders(&x264Params),
// 	)

// 	_ = codecSelector

// 	// Get screen size
// 	screens, err := runtime.ScreenGetAll(a.ctx)
// 	if err != nil {
// 		log.Printf("unable to get screens: %v", err)
// 		return
// 	}

// 	userScreen := types.NewScreenDimension(400, 600)
// 	if len(screens) > 0 {
// 		userScreen.Height = prop.Int(screens[0].Size.Height)
// 		userScreen.Width = prop.Int(screens[0].Size.Width)
// 	}
// 	fmt.Printf("Screen Size: Height: %d & Width: %d\n", userScreen.Height, userScreen.Width)

// 	// Get user media stream
// 	stream, err := mediadevices.GetUserMedia(mediadevices.MediaStreamConstraints{
// 		Video: func(c *mediadevices.MediaTrackConstraints) {
// 			c.Width = userScreen.Width
// 			c.Height = userScreen.Height
// 		},
// 		// Codec: codecSelector,
// 	})
// 	if err != nil {
// 		log.Fatalf("failed to get media stream: %v", err)
// 	}

// 	videoTracks := stream.GetVideoTracks()
// 	if len(videoTracks) == 0 {
// 		log.Fatalf("no video tracks found")
// 	}

// 	// Cast to VideoTrack
// 	videoTrack, ok := videoTracks[0].(*mediadevices.VideoTrack)
// 	if !ok {
// 		log.Fatalf("failed to cast to VideoTrack")
// 	}
// 	defer videoTrack.Close()

// 	videoReader := videoTrack.NewReader(false)
// 	frame, release, err := videoReader.Read()
// 	if err != nil {
// 		log.Fatalf("failed to read video frame: %v", err)
// 	}
// 	defer release()

// 	// Save frame to file
// 	output, err := os.Create("frame.jpg")
// 	if err != nil {
// 		log.Fatalf("failed to create file: %v", err)
// 	}
// 	defer output.Close()

// 	err = jpeg.Encode(output, frame, nil)
// 	if err != nil {
// 		log.Fatalf("failed to encode JPEG: %v", err)
// 	}

// 	fmt.Println("Screenshot saved as frame.jpg")
// }

func (a *App) StartRecording() error {
	a.recordingMux.Lock()
	defer a.recordingMux.Unlock()

	if a.isRecording {
		return fmt.Errorf("recording is already in progress")
	}

	runtime.EventsEmit(a.ctx, "recording_preparing")

	a.isRecording = true
	a.stopRecording = make(chan bool)
	a.recordingStartTime = time.Now()

	a.zoomPointsMux.Lock()
	a.zoomPoints = []ZoomPoint{}
	a.zoomPointsMux.Unlock()

	go func() {
		time.Sleep(100 * time.Millisecond)
		runtime.EventsEmit(a.ctx, "recording_started")
		a.recordScreen()
	}()

	a.startMouseCapture()
	return nil
}

func (a *App) StopRecording() error {
	a.recordingMux.Lock()
	defer a.recordingMux.Unlock()

	if !a.isRecording {
		return fmt.Errorf("no recording in progress")
	}

	close(a.stopRecording)
	a.isRecording = false

	runtime.EventsEmit(a.ctx, "recording_stopped")

	return nil
}

func (a *App) IsRecording() bool {
	a.recordingMux.Lock()
	defer a.recordingMux.Unlock()
	return a.isRecording
}

func (a *App) SetResolution(resolution string) error {
	_, err := parseResolution(resolution)
	if err != nil {
		return fmt.Errorf("invalid resolution format: %v", err)
	}

	a.recordingMux.Lock()
	defer a.recordingMux.Unlock()

	if a.isRecording {
		return fmt.Errorf("cannot change resolution while recording")
	}

	a.resolution = resolution
	return nil
}

func (a *App) GetResolution() string {
	a.recordingMux.Lock()
	defer a.recordingMux.Unlock()
	return a.resolution
}

func (a *App) GetAvailableResolutions() []string {
	return []string{
		Resolution720p,
		Resolution1080p,
		Resolution1440p,
		Resolution4K,
	}
}

func (a *App) GetCaptureDevices() ([]CaptureDevice, error) {
	cmd := exec.Command("ffmpeg", "-f", "avfoundation", "-list_devices", "true", "-i", "")
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	cmd.Run()

	output := stderr.String()

	fmt.Printf("\n\n%s\n\n", output)

	var devices []CaptureDevice

	re := regexp.MustCompile(`\[(\d+)\] (Capture screen \d+)`)
	matches := re.FindAllStringSubmatch(output, -1)

	for _, match := range matches {
		if len(match) >= 3 {
			index, err := strconv.Atoi(match[1])
			if err != nil {
				continue
			}
			devices = append(devices, CaptureDevice{
				Index: index,
				Name:  match[2],
			})
		}
	}

	return devices, nil
}

func (a *App) SetSelectedDevice(deviceIndex int) error {
	a.deviceMux.Lock()
	defer a.deviceMux.Unlock()

	if a.isRecording {
		return fmt.Errorf("cannot change device while recording")
	}

	a.selectedDevice = deviceIndex
	return nil
}

func (a *App) GetSelectedDevice() int {
	a.deviceMux.Lock()
	defer a.deviceMux.Unlock()
	return a.selectedDevice
}

/* my issues when using kibani/screenshot
at 30fps, when I calculate diff myself, I get ~15ps
at 60fps, same thing, I get ~12fps
at 90fps, ~12fps
*/

func (a *App) recordScreen() {
	defer func() {
		a.recordingMux.Lock()
		a.isRecording = false
		a.recordingMux.Unlock()
		runtime.EventsEmit(a.ctx, "recording_stopped")

	}()

	frameRate := 60

	resDim, err := a.GetResolutionDimensions()
	if err != nil {
		log.Printf("Error parsing resolution: %v", err)
		resDim = ResolutionDimensions{Width: 1920, Height: 1080}
	}

	a.deviceMux.Lock()
	selectedDevice := a.selectedDevice

	a.deviceMux.Unlock()
	fmt.Printf("The selected device is: %d\n", selectedDevice)

	fmt.Printf("Width: %d, Height: %d, Device: %d\n", resDim.Width, resDim.Height, selectedDevice)

	deviceInput := fmt.Sprintf("%d:none", selectedDevice)

	// scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,
	cmd := exec.Command("ffmpeg",
		"-f", "avfoundation",
		"-capture_cursor", "1",
		"-framerate", fmt.Sprintf("%d", frameRate),
		"-i", deviceInput,
		"-c:v", "libx264",
		"-preset", "medium",
		"-crf", "23",
		"-pix_fmt", "uyvy422",
		"-vf", "eq=brightness=0.019:saturation=1.15:gamma=0.8",
		"-f", "mp4",
		"-movflags", "frag_keyframe+empty_moov+default_base_moof",
		"-flush_packets", "1",
		"-r", fmt.Sprintf("%d", frameRate),
		"pipe:1",
	)

	cmd.Stderr = os.Stderr

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("Error creating stdout pipe: %v", err)
		return
	}

	if err := cmd.Start(); err != nil {
		log.Printf("Error starting ffmpeg: %v", err)
		return
	}

	var reocrdedData bytes.Buffer

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stdout.Read(buf)
			if n > 0 {
				reocrdedData.Write(buf[:n])
			}
			if err != nil {
				break
			}
		}
	}()

	<-a.stopRecording
	if err := cmd.Process.Kill(); err != nil {
		log.Printf("Error killing ffmpeg: %v", err)
	}
	cmd.Wait()

	err = os.WriteFile("recorded.mp4", reocrdedData.Bytes(), 0644)
	if err != nil {
		fmt.Println("unable to save file:", err)
		return
	}

	runtime.EventsEmit(a.ctx, "recording_complete", reocrdedData.Bytes())
}

func (a *App) SaveFile(data []byte) error {

	randId := uuid.New().String()
	fileName := fmt.Sprintf("recording-%s.mp4", randId)
	result, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save MP4 Video",
		Filters:         []runtime.FileFilter{{DisplayName: "MP4 Video", Pattern: "*.mp4"}},
		DefaultFilename: fileName,
	})
	if err != nil || result == "" {
		return fmt.Errorf("save cancelled or failed: %v", err)
	}

	a.zoomPointsMux.Lock()
	hasZoomPoints := len(a.zoomPoints) > 0
	zoomPoints := make([]ZoomPoint, len(a.zoomPoints))
	copy(zoomPoints, a.zoomPoints)
	a.zoomPointsMux.Unlock()

	path := "recording-zoom.mp4"

	if hasZoomPoints {
		fmt.Printf("Applying zoom effects to %d points\n", len(zoomPoints))
		return a.saveFileWithZoom(data, path, zoomPoints)
	}

	return os.WriteFile(path, data, 0644)
}

func (a *App) buildZoomFilter(zoomPoints []ZoomPoint) string {
	if len(zoomPoints) == 0 {
		return "null"
	}

	fps := 60.0
	zoomDuration := 2.0
	zoomFactor := 2.0

	resDim, err := a.GetResolutionDimensions()
	if err != nil {
		log.Printf("Error parsing resolution for zoom filter: %v", err)
		resDim = ResolutionDimensions{Width: 1920, Height: 1080}
	}

	a.recordingMux.Lock()
	recordingStartTime := a.recordingStartTime
	a.recordingMux.Unlock()

	point := zoomPoints[0]
	startFrame := int(point.Timestamp.Sub(recordingStartTime).Seconds() * fps)
	endFrame := startFrame + int(zoomDuration*fps)

	zoomExpr := fmt.Sprintf(
		"if(between(on,%d,%d), 1+(%.2f-1)*(1-abs(2*(on-%d)/%d-1)), 1)",
		startFrame, endFrame, zoomFactor, startFrame, endFrame-startFrame,
	)

	xExpr := fmt.Sprintf("%d-(iw/zoom/2)", point.X)
	yExpr := fmt.Sprintf("%d-(ih/zoom/2)", point.Y)

	return fmt.Sprintf(
		"zoompan=z='%s':x='%s':y='%s':d=1:fps=%.0f,scale=iw:ih:force_original_aspect_ratio=increase,crop=%d:%d",
		zoomExpr, xExpr, yExpr, fps, resDim.Width, resDim.Height,
	)
}

func (a *App) saveFileWithZoom(data []byte, outputPath string, zoomPoints []ZoomPoint) error {
	tempInput := fmt.Sprintf("./tmp/temp_recording_%s.mp4", uuid.New().String())
	if err := os.WriteFile(tempInput, data, 0644); err != nil {
		return fmt.Errorf("failed to write temp file: %v", err)
	}
	defer os.Remove(tempInput)

	filterComplex := a.buildZoomFilter(zoomPoints)

	fmt.Printf("Using filter: %s\n", filterComplex)

	cmd := exec.Command("ffmpeg",
		"-i", tempInput,
		"-vf", filterComplex,
		"-c:a", "copy",
		"-y",
		outputPath,
	)

	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to apply zoom effects: %v", err)
	}

	fmt.Printf("Video saved with zoom effects at: %s\n", outputPath)
	return nil
}

func (a *App) GetZoomPoints() []ZoomPoint {
	a.zoomPointsMux.Lock()
	defer a.zoomPointsMux.Unlock()

	points := make([]ZoomPoint, len(a.zoomPoints))
	copy(points, a.zoomPoints)
	return points
}

func (a *App) startMouseCapture() {
	a.mouseMux.Lock()
	defer a.mouseMux.Unlock()

	if !a.mouseCapture {
		a.mouseCapture = true
		go a.captureMouseClickPos()
		go a.handleMouseClicks()
	}
}

func (a *App) captureMouseClickPos() {
	defer func() {
		a.mouseMux.Lock()
		a.mouseCapture = false
		a.mouseMux.Unlock()
	}()

	for {
		a.recordingMux.Lock()
		recordingStopped := !a.isRecording
		a.recordingMux.Unlock()

		a.previewMux.Lock()
		previewStopped := !a.isPreview
		a.previewMux.Unlock()

		if recordingStopped && previewStopped {
			return
		}

		mleft := hook.AddEvent("mleft")
		if mleft {
			x, y := robotgo.Location()
			select {
			case a.mousePos <- struct {
				x int
				y int
			}{x, y}:

			default:

			}
		}

		time.Sleep(10 * time.Millisecond)
	}
}

// handleMouseClicks processes mouse click events and stores zoom points during recording
func (a *App) handleMouseClicks() {
	for {
		select {
		case mouseClick := <-a.mousePos:
			a.recordingMux.Lock()
			isRecording := a.isRecording
			recordingStartTime := a.recordingStartTime
			a.recordingMux.Unlock()

			if isRecording {
				relativeTime := time.Since(recordingStartTime)

				a.zoomPointsMux.Lock()
				a.zoomPoints = append(a.zoomPoints, ZoomPoint{
					X:         mouseClick.x,
					Y:         mouseClick.y,
					Timestamp: recordingStartTime.Add(relativeTime),
				})
				a.zoomPointsMux.Unlock()

				fmt.Printf("Zoom point recorded at position: X=%d, Y=%d, RelativeTime=%.2fs\n",
					mouseClick.x, mouseClick.y, relativeTime.Seconds())
			}

		default:
			a.recordingMux.Lock()
			recordingStopped := !a.isRecording
			a.recordingMux.Unlock()

			a.previewMux.Lock()
			previewStopped := !a.isPreview
			a.previewMux.Unlock()

			if recordingStopped && previewStopped {
				return
			}

			time.Sleep(10 * time.Millisecond)
		}
	}
}

// func eventHook() {
// 	// Add mouse event hook
// 	robotgo.Click()
// 	defer robotgo.EventEnd()

// 	for e := range evChan {
// 		// Check for mouse button events
// 		if e.Kind == robotgo.MouseDown {
// 			// Get current mouse position when click occurs
// 			x, y := robotgo.Location()

// 			switch e.Button {
// 			case robotgo.Left:
// 				fmt.Printf("Left click detected at coordinates: X=%d, Y=%d\n", x, y)
// 			case robotgo.Right:
// 				fmt.Printf("Right click detected at coordinates: X=%d, Y=%d\n", x, y)
// 			case robotgo.Center:
// 				fmt.Printf("Middle click detected at coordinates: X=%d, Y=%d\n", x, y)
// 			}
// 		}
// 	}
// }
