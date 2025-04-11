# Plex Encoder

A desktop application to scan, monitor, and re-encode media files in Plex libraries to HEVC 10-bit format using the Intel Arc GPU for hardware acceleration.

## Features

- Scan Plex media libraries for non-HEVC/AV1 encoded files
- Automatically detect and monitor for new media files
- Queue and process files for re-encoding to HEVC 10-bit format
- Use Intel Arc GPU with QSV hardware acceleration
- Dashboard UI to monitor progress and manage jobs
- Schedule encoding to run during off-peak hours
- Run multiple encoding jobs in parallel
- Track file size reduction statistics
- Restart failed encoding jobs
- Search functionality for job history

## Requirements

### For Runtime (Windows)
- Windows Server or Windows 10/11
- Intel CPU
- Intel Arc GPU for hardware acceleration
- FFmpeg (bundled with the application)

### For Development (Any Platform)
- Node.js 16+ 
- npm or yarn
- Python (for node-gyp dependency building)
- Platform-specific build tools:
  - Windows: Visual Studio Build Tools
  - macOS: XCode Command Line Tools
  - Linux: build-essential package

## Platform Support

- **Development**: You can develop on any platform (Windows, macOS, Linux)
- **Deployment**: The application is designed to run on Windows to leverage Intel Arc GPU hardware acceleration
- **Note**: While the Electron app itself is cross-platform, the hardware acceleration features specifically target Intel QSV on Windows

## Installation

### For Users

1. Download the latest release from the Releases page
2. Extract the archive and run the installer
3. Launch the application

### For Developers

1. Clone the repository
```bash
git clone https://github.com/yourusername/encoder-project.git
cd encoder-project
```

2. Install dependencies
```bash
npm install
```

3. Start the development environment
```bash
npm run dev
```

4. Build the application
```bash
# For Windows (target platform)
npm run build

# For cross-platform building from macOS or Linux
# You'll need additional configuration in electron-builder
```

### Troubleshooting Installation Issues

If you encounter issues with the better-sqlite3 dependency during installation:

#### Windows

1. Make sure you have the required build tools (Windows only):
```bash
# Only run this on Windows - will not work on macOS or Linux
npm install --global --production windows-build-tools
```

2. If that doesn't resolve the issue, try to install it with options:
```bash
npm install better-sqlite3 --build-from-source
```

#### macOS (for development only)

1. First, ensure XCode Command Line Tools are installed:
```bash
xcode-select --install
```

2. Install dependencies using Homebrew:
```bash
brew install python node sqlite
```

3. You may need to specify the Python path:
```bash
npm install --python=/usr/bin/python3
```

4. For native module issues, try:
```bash
npm install --force
```

5. For cross-compiling to Windows from macOS:
```bash
# Note: This is for advanced users as cross-compiling has limitations
npm install --platform=win32 --arch=x64
```

#### Linux (for development only)

1. Install required dependencies:
```bash
sudo apt-get install python build-essential sqlite3 libsqlite3-dev
```

## Usage

1. Start the application
2. Enter your Plex library path and scan for media files
3. The application will scan and identify files that need re-encoding
4. Configure encoding schedule in the Settings
5. Monitor progress in the Dashboard
6. Search for specific jobs in the Jobs section

## Architecture

- **Electron**: Cross-platform desktop application framework
- **React**: UI framework
- **SQLite**: Local database for tracking files and jobs
- **FFmpeg**: Media encoding tools
- **Intel QSV**: Hardware acceleration for encoding

## Project Structure

```
encoder-project/
├── main.js              # Electron main process
├── preload.js           # Electron preload script
├── src/
│   ├── components/      # React components
│   ├── pages/           # React pages
│   ├── services/        # Business logic
│   │   ├── database.js  # Database operations
│   │   ├── scanner.js   # File scanning
│   │   ├── encoder.js   # Encoding service
│   │   └── scheduler.js # Scheduler
│   ├── utils/           # Utility functions
│   └── App.jsx          # Main React component
├── public/              # Static assets
└── database/            # SQLite database files
```

## Development Notes

- The application uses Electron for cross-platform desktop development
- The UI is built with React and uses CSS for styling
- FFmpeg is used for media analysis and transcoding
- Intel QSV hardware acceleration is used when available (Windows only)
- SQLite database is used for persistent storage
- Development can happen on any platform, but the hardware acceleration features are Windows-specific

## License

MIT 