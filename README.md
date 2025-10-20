# Screen Recorder

A powerful, cross-platform screen recording application built with Wails (Go + React/TypeScript). Record your screen with customizable settings, smart zoom effects, and high-quality output.

## ✨ Features

- **High-Quality Recording**: Record your screen in multiple resolutions (720p, 1080p, 1440p, 4K)
- **Smart Zoom Effects**: Automatically creates zoom effects when you click during recording
- **Flexible Frame Rates**: Output videos at 30, 60, or custom frame rates
- **Multiple Capture Devices**: Select from available screen capture devices
- **Cursor Capture**: Records cursor movements and interactions
- **Real-time Preview**: See what you're recording in real-time
- **Custom Video Processing**: Enhanced video quality with brightness, saturation, and gamma adjustments
- **Cross-Platform**: Works on macOS, Linux, and Windows
- **Modern UI**: Clean, intuitive interface built with React and Tailwind CSS

## 🛠️ Tech Stack

### Backend
- **Go**: Core application logic and screen capture
- **Wails v2**: Desktop application framework
- **FFmpeg**: Video processing and encoding
- **RobotGo**: Mouse and keyboard event handling

### Frontend
- **React 19**: Modern React with latest features
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Vite**: Fast development and build tool
- **Radix UI**: Accessible UI components

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Go** (1.23 or later)
- **Node.js** (18 or later)
- **FFmpeg** - Required for video processing
  ```bash
  # macOS
  brew install ffmpeg
  
  # Ubuntu/Debian
  sudo apt update && sudo apt install ffmpeg
  
  # Windows
  # Download from https://ffmpeg.org/download.html
  ```
- **Wails CLI**
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone https://github.com/emeraldls/open-recorder
cd open-recorder
```

### 2. Install Dependencies
```bash
# Install Go dependencies
go mod tidy

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Development Mode
```bash
# Run in development mode with hot reload
wails dev
```

The app will open automatically. You can also access the dev server at http://localhost:34115 for browser debugging.

### 4. Build for Production
```bash
# Build a distributable application
wails build
```

The built application will be in the `build/bin/` directory.

## 📖 How to Use

### Recording Your Screen

1. **Select Capture Device**: Choose which screen or display to record from the dropdown
2. **Choose Resolution**: Select your preferred recording resolution (720p to 4K)
3. **Start Recording**: Click the record button to begin
4. **Add Zoom Effects**: Click anywhere on your screen during recording to add automatic zoom effects at those points
5. **Stop Recording**: Click stop when finished
6. **Save Your Video**: Choose location and frame rate for your final video

### Zoom Effects

The app automatically creates cinematic zoom effects when you click during recording:
- Click once to mark a zoom point
- The final video will smoothly zoom into clicked areas
- Zoom duration: 2 seconds
- Zoom factor: 2x magnification

### Supported Output Formats

- **Resolution**: 720p, 1080p, 1440p, 4K
- **Frame Rates**: 30fps, 60fps, or custom
- **Format**: MP4 with H.264 encoding
- **Quality**: Optimized with medium preset and CRF 23

## ⚙️ Configuration

### Video Settings
The app uses optimized FFmpeg settings for high-quality recordings:
- **Codec**: H.264 (libx264)
- **Preset**: Medium (balance of speed and compression)
- **Pixel Format**: UYVY422
- **Color Enhancement**: Brightness +1.9%, Saturation +15%, Gamma 0.8

### Customization
You can modify recording parameters in `app.go`:
- Frame rates
- Video quality settings
- Zoom effect duration and intensity
- Color correction values

## 🔧 Development

### Project Structure
```
screen-recorder/
├── app.go              # Main Go application logic
├── main.go             # Application entry point
├── wails.json          # Wails configuration
├── frontend/           # React frontend
│   ├── src/
│   │   ├── views/      # Main application views
│   │   ├── components/ # Reusable UI components
│   │   └── lib/        # Utility functions
└── build/              # Build outputs and assets
```

### Adding Features

1. **Backend (Go)**: Add new methods to the `App` struct in `app.go`
2. **Frontend (React)**: Components are in `frontend/src/components/`
3. **Styling**: Uses Tailwind CSS for consistent design
4. **State Management**: React hooks for local state

## 👨‍💻 Author

**Oluwasegun Lawrence**
- Email: lawrencesegun025@gmail.com