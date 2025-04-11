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

- Windows Server (developed for Windows)
- Intel CPU
- Intel Arc GPU for hardware acceleration
- FFmpeg (included in the application)
- Node.js 16+ (for development only)

## Installation

### For Users

1. Download the latest release from the Releases page
2. Extract the archive and run the installer
3. Launch the application

### For Developers

1. Clone the repository
```bash
git clone https://github.com/yourusername/plex-encoder.git
cd plex-encoder
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
npm run build
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
- **FFmpeg/Handbrake**: Media encoding tools
- **Intel QSV**: Hardware acceleration for encoding

## Project Structure

```
plex-encoder/
├── main.js              # Electron main process
├── preload.js           # Electron preload script
├── src/
│   ├── components/      # React components
│   ├── pages/           # React pages
│   ├── services/        # Business logic
│   │   ├── database.js  # Database operations
│   │   ├── scanner.js   # File scanning
│   │   ├── encoder.js   # Encoding service
│   │   ├── monitor.js   # File monitor
│   │   └── scheduler.js # Scheduler
│   ├── utils/           # Utility functions
│   └── App.js           # Main React component
├── public/              # Static assets
└── database/            # SQLite database files
```

## License

MIT 