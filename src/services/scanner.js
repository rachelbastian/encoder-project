const path = require('path');
const fs = require('fs-extra');
const { promisify } = require('util');
const chokidar = require('chokidar');
const { BrowserWindow } = require('electron');
const ffmpeg = require('fluent-ffmpeg');
const { addMedia, getMediaNeedingEncoding, createEncodingJob } = require('./database');

// FFmpeg probe is callback based, let's promisify it
const ffprobeAsync = promisify((filePath, callback) => {
  ffmpeg.ffprobe(filePath, callback);
});

// Global watcher reference
let watcher = null;

/**
 * Initialize the scanner service
 */
async function initializeScanner() {
  // Nothing to initialize yet, but this keeps the API consistent
  console.log('Scanner service initialized');
  return true;
}

/**
 * Scan a library directory for media files
 * @param {string} libraryPath - Path to the library directory
 */
async function scanLibrary(libraryPath) {
  try {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    const results = {
      scanned: 0,
      added: 0,
      errors: 0,
      needsEncoding: 0
    };
    
    // Start watching this directory for changes
    setupWatcher(libraryPath);
    
    // Process files recursively
    await scanDirectory(libraryPath, results, mainWindow);
    
    console.log(`Scan completed: ${results.scanned} files scanned, ${results.added} added to database, ${results.needsEncoding} need encoding`);
    
    // Queue encoding for files that need it
    await queueEncodingJobs();
    
    return results;
  } catch (error) {
    console.error('Error scanning library:', error);
    throw error;
  }
}

/**
 * Scan a directory recursively for media files
 */
async function scanDirectory(dirPath, results, mainWindow, depth = 0) {
  try {
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        await scanDirectory(fullPath, results, mainWindow, depth + 1);
      } else if (isMediaFile(file)) {
        results.scanned++;
        
        // Update progress in UI
        if (mainWindow) {
          mainWindow.webContents.send('scan-progress', {
            currentFile: fullPath,
            totalScanned: results.scanned,
            added: results.added
          });
        }
        
        try {
          // Process the media file
          const added = await processMediaFile(fullPath, stat.size);
          if (added) {
            results.added++;
            if (added.needsEncoding) {
              results.needsEncoding++;
            }
          }
        } catch (error) {
          console.error(`Error processing file ${fullPath}:`, error);
          results.errors++;
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
    results.errors++;
  }
}

/**
 * Check if a file is a media file based on extension
 */
function isMediaFile(filename) {
  const mediaExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.m4v', '.mpg', '.mpeg', '.flv'];
  const ext = path.extname(filename).toLowerCase();
  return mediaExtensions.includes(ext);
}

/**
 * Process a media file and add it to the database
 */
async function processMediaFile(filePath, fileSize) {
  try {
    // Get media info using ffprobe
    const metadata = await ffprobeAsync(filePath);
    
    // Extract video stream to determine encoding
    const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
    if (!videoStream) {
      console.log(`No video stream found in ${filePath}`);
      return null;
    }
    
    // Determine title and episode name from path
    const { title, episodeName, mediaType } = extractMediaInfo(filePath);
    
    // Create media info object
    const mediaInfo = {
      title,
      episode_name: episodeName,
      directory: path.dirname(filePath),
      file_path: filePath,
      file_size_bytes: fileSize,
      encoding_type: videoStream.codec_name,
      media_type: mediaType,
    };
    
    // Add to database
    const mediaId = addMedia(mediaInfo);
    
    // Calculate if this needs encoding
    const needsEncoding = !['hevc', 'h265', 'av1'].includes(videoStream.codec_name.toLowerCase());
    
    return { mediaId, needsEncoding };
  } catch (error) {
    console.error(`Failed to process media file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Extract media info from file path
 */
function extractMediaInfo(filePath) {
  // Basic info extraction from filepath
  // This can be improved with more sophisticated parsing
  const fileName = path.basename(filePath, path.extname(filePath));
  const dirName = path.basename(path.dirname(filePath));
  
  // Try to determine if it's a TV show (has season/episode markers)
  const episodeMatch = fileName.match(/S(\d+)E(\d+)|(\d+)x(\d+)/i);
  
  if (episodeMatch) {
    // It's likely a TV show
    // Remove the episode part from the filename to get the title
    const title = dirName; // Usually the show name is the directory name
    return { 
      title, 
      episodeName: fileName,
      mediaType: 'tv' 
    };
  } else {
    // It's likely a movie
    return { 
      title: fileName, 
      episodeName: null,
      mediaType: 'movie' 
    };
  }
}

/**
 * Queue encoding jobs for media that needs encoding
 */
async function queueEncodingJobs() {
  try {
    const mediaToEncode = getMediaNeedingEncoding(100);
    console.log(`Found ${mediaToEncode.length} files that need encoding`);
    
    for (const media of mediaToEncode) {
      // Create encoding job
      // Priority based on file size (larger files get higher priority)
      const priority = Math.floor(media.file_size_bytes / (1024 * 1024 * 100)); // 100MB increments
      const jobId = createEncodingJob(media.id, priority);
      console.log(`Created encoding job ${jobId} for ${media.title}`);
    }
    
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('queue-update');
    }
    
    return mediaToEncode.length;
  } catch (error) {
    console.error('Error queueing encoding jobs:', error);
    throw error;
  }
}

/**
 * Set up a watcher to monitor for new or changed media files
 */
function setupWatcher(directoryPath) {
  // Close existing watcher if any
  if (watcher) {
    watcher.close();
  }
  
  console.log(`Setting up watcher for ${directoryPath}`);
  
  watcher = chokidar.watch(directoryPath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });
  
  watcher
    .on('add', async filePath => {
      console.log(`New file detected: ${filePath}`);
      if (isMediaFile(filePath)) {
        try {
          const stat = await fs.stat(filePath);
          await processMediaFile(filePath, stat.size);
          // If new file needs encoding, add it to the queue
          await queueEncodingJobs();
        } catch (error) {
          console.error(`Error processing new file ${filePath}:`, error);
        }
      }
    })
    .on('change', async filePath => {
      console.log(`File changed: ${filePath}`);
      if (isMediaFile(filePath)) {
        try {
          const stat = await fs.stat(filePath);
          await processMediaFile(filePath, stat.size);
        } catch (error) {
          console.error(`Error processing changed file ${filePath}:`, error);
        }
      }
    })
    .on('error', error => {
      console.error(`Watcher error: ${error}`);
    });
  
  return watcher;
}

module.exports = {
  initializeScanner,
  scanLibrary,
  isMediaFile,
  setupWatcher
}; 