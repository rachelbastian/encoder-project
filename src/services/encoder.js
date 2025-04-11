const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { promisify } = require('util');
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const { BrowserWindow } = require('electron');
const { 
  getJobsByStatus, 
  updateJobStatus, 
  markMediaAsEncoded, 
  getJobById 
} = require('./database');

// Number of parallel encoding jobs
let maxParallelJobs = 2; // Default, will be updated from schedule
let activeJobs = 0;
let isQueuePaused = false;
let activeJobsMap = new Map(); // Map to track active encoding processes

// Intel Arc hardware acceleration settings
const qsvPresets = {
  quality: 'veryfast', // Options: veryslow, slower, slow, medium, fast, faster, veryfast, superfast, ultrafast
  profile: 'main10',   // Options: main, main10
};

// FFmpeg probe is callback based, let's promisify it
const ffprobeAsync = promisify((filePath, callback) => {
  ffmpeg.ffprobe(filePath, callback);
});

/**
 * Initialize the encoder service
 */
async function initializeEncoder() {
  console.log('Encoder service initialized');
  
  // Start processing queue
  setTimeout(() => processEncodingQueue(), 5000);
  
  return true;
}

/**
 * Process the encoding queue
 */
async function processEncodingQueue() {
  try {
    if (isQueuePaused) {
      console.log('Encoding queue is paused');
      setTimeout(() => processEncodingQueue(), 10000);
      return;
    }
    
    // Check if we can process more jobs
    const availableSlots = maxParallelJobs - activeJobs;
    
    if (availableSlots <= 0) {
      // All slots are occupied, check again later
      setTimeout(() => processEncodingQueue(), 10000);
      return;
    }
    
    // Get jobs that are queued
    const queuedJobs = getJobsByStatus('queued', availableSlots);
    
    if (queuedJobs.length === 0) {
      // No jobs in queue, check again later
      setTimeout(() => processEncodingQueue(), 10000);
      return;
    }
    
    // Start processing each job
    for (const job of queuedJobs) {
      startEncodingJob(job);
    }
    
    // Check again later for more jobs
    setTimeout(() => processEncodingQueue(), 5000);
  } catch (error) {
    console.error('Error processing encoding queue:', error);
    // Try again after a delay
    setTimeout(() => processEncodingQueue(), 30000);
  }
}

/**
 * Start encoding a specific job
 */
async function startEncodingJob(job) {
  try {
    activeJobs++;
    
    // Update job status to processing
    updateJobStatus(job.id, 'processing');
    
    // Notify UI about job status change
    notifyJobStatusChange(job.id, 'processing');
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), 'plex-encoder');
    await fs.ensureDir(tempDir);
    
    // Generate a temp filename
    const inputExt = path.extname(job.file_path);
    const tempFileName = `${path.basename(job.file_path, inputExt)}_hevc_temp${inputExt}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    // Update job with temp path
    updateJobStatus(job.id, 'processing', { temp_file_path: tempFilePath });
    
    console.log(`Starting encoding job ${job.id} for ${job.title}`);
    
    // Check for Intel Arc GPU
    const gpuInfo = await getGpuInfo();
    const useHardwareAcceleration = gpuInfo.hasIntelArc;
    
    // Start encoding process
    const encodingProcess = startFFmpegEncoding(
      job.file_path, 
      tempFilePath, 
      useHardwareAcceleration,
      job
    );
    
    // Store the encoding process in the map
    activeJobsMap.set(job.id, encodingProcess);
    
  } catch (error) {
    console.error(`Error starting encoding job ${job.id}:`, error);
    
    // Update job status to failed
    updateJobStatus(job.id, 'failed', { 
      error_message: error.message || 'Unknown error' 
    });
    
    // Notify UI about job status change
    notifyJobStatusChange(job.id, 'failed');
    
    // Decrease active jobs counter
    activeJobs--;
  }
}

/**
 * Start FFmpeg encoding process
 */
function startFFmpegEncoding(inputPath, outputPath, useHardwareAcceleration, job) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get source file info for comparison later
      const sourceFileSize = job.original_size_bytes;
      
      // Build FFmpeg command
      let ffmpegArgs = [
        '-i', inputPath,
        '-c:v', useHardwareAcceleration ? 'hevc_qsv' : 'libx265',
        '-preset', useHardwareAcceleration ? qsvPresets.quality : 'medium',
        '-crf', '28',                  // Constant Rate Factor for quality
        '-pix_fmt', 'p010le',          // 10-bit pixel format
        '-tag:v', 'hvc1',              // Makes HEVC videos compatible with Apple devices
        '-c:a', 'copy',                // Copy audio streams without re-encoding
        '-c:s', 'copy',                // Copy subtitle streams
        outputPath
      ];
      
      // Add Intel Arc specific options if available
      if (useHardwareAcceleration) {
        ffmpegArgs = [
          '-hwaccel', 'qsv',              // Use Intel QuickSync hardware acceleration
          '-hwaccel_device', '0',         // Specify GPU device (0 is usually the first/primary GPU)
          ...ffmpegArgs,
          '-load_plugin', 'hevc_hw',      // Load HEVC hardware plugin for Intel QSV
          '-profile:v', qsvPresets.profile // Use 10-bit profile for better quality
        ];
      }
      
      // Start FFmpeg process
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
      
      let stdoutData = '';
      let stderrData = '';
      let progress = {};
      
      ffmpegProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      ffmpegProcess.stderr.on('data', (data) => {
        const dataStr = data.toString();
        stderrData += dataStr;
        
        // Extract progress information
        const timeMatch = dataStr.match(/time=(\d+:\d+:\d+.\d+)/);
        if (timeMatch) {
          progress.time = timeMatch[1];
          
          // Notify UI about progress
          notifyJobProgress(job.id, progress);
        }
      });
      
      ffmpegProcess.on('close', async (code) => {
        if (code === 0) {
          // Encoding completed successfully
          try {
            // Get the temporary file size
            const tempStat = await fs.stat(outputPath);
            const newSizeBytes = tempStat.size;
            const sizeReductionPercent = ((sourceFileSize - newSizeBytes) / sourceFileSize) * 100;
            
            console.log(`Encoding job ${job.id} completed. Size reduction: ${sizeReductionPercent.toFixed(2)}%`);
            
            // Update job with new file size and reduction
            updateJobStatus(job.id, 'replacing_file', { 
              new_size_bytes: newSizeBytes,
              size_reduction_percent: sizeReductionPercent
            });
            
            // Replace the original file
            await replaceOriginalFile(inputPath, outputPath, job.id);
            
          } catch (error) {
            console.error(`Error completing job ${job.id}:`, error);
            updateJobStatus(job.id, 'failed', { 
              error_message: `Error finalizing: ${error.message}` 
            });
            notifyJobStatusChange(job.id, 'failed');
            activeJobs--;
            activeJobsMap.delete(job.id);
            reject(error);
          }
        } else {
          // Encoding failed
          const errorMsg = `FFmpeg encoding failed with code ${code}: ${stderrData}`;
          console.error(errorMsg);
          
          updateJobStatus(job.id, 'failed', { 
            error_message: errorMsg 
          });
          
          notifyJobStatusChange(job.id, 'failed');
          
          activeJobs--;
          activeJobsMap.delete(job.id);
          reject(new Error(errorMsg));
        }
      });
      
      ffmpegProcess.on('error', (error) => {
        console.error(`FFmpeg process error for job ${job.id}:`, error);
        
        updateJobStatus(job.id, 'failed', { 
          error_message: `Process error: ${error.message}` 
        });
        
        notifyJobStatusChange(job.id, 'failed');
        
        activeJobs--;
        activeJobsMap.delete(job.id);
        reject(error);
      });
      
      return ffmpegProcess;
    } catch (error) {
      console.error(`Error in FFmpeg encoding for job ${job.id}:`, error);
      activeJobs--;
      activeJobsMap.delete(job.id);
      reject(error);
    }
  });
}

/**
 * Replace the original file with the newly encoded one
 */
async function replaceOriginalFile(originalPath, tempPath, jobId) {
  try {
    // Ensure the directories exist
    await fs.ensureDir(path.dirname(originalPath));
    
    // Check if output file exists and has content
    const tempStat = await fs.stat(tempPath);
    if (tempStat.size === 0) {
      throw new Error('Encoded file is empty');
    }
    
    // Get media info to determine the new encoding type
    const metadata = await ffprobeAsync(tempPath);
    const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
    const newEncodingType = videoStream ? videoStream.codec_name : 'unknown';
    
    // Move the temporary file to replace the original
    await fs.move(tempPath, originalPath, { overwrite: true });
    
    // Get the job with media information
    const job = getJobById(jobId);
    
    // Update media record to mark as encoded
    markMediaAsEncoded(job.media_id, newEncodingType, tempStat.size);
    
    // Update job status to completed
    updateJobStatus(jobId, 'completed');
    
    // Notify UI about job completion
    notifyJobStatusChange(jobId, 'completed');
    
    console.log(`Successfully replaced original file for job ${jobId}`);
    
    // Cleanup: Decrease active jobs counter and remove from map
    activeJobs--;
    activeJobsMap.delete(jobId);
    
    return true;
  } catch (error) {
    console.error(`Error replacing original file for job ${jobId}:`, error);
    
    // Update job status to failed
    updateJobStatus(jobId, 'failed', { 
      error_message: `Error replacing original file: ${error.message}` 
    });
    
    // Notify UI about job failure
    notifyJobStatusChange(jobId, 'failed');
    
    // Cleanup: Decrease active jobs counter and remove from map
    activeJobs--;
    activeJobsMap.delete(jobId);
    
    throw error;
  }
}

/**
 * Notify UI about job status change
 */
function notifyJobStatusChange(jobId, status) {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    mainWindow.webContents.send('job-status-change', { 
      jobId, 
      status 
    });
    mainWindow.webContents.send('queue-update');
  }
}

/**
 * Notify UI about job progress
 */
function notifyJobProgress(jobId, progress) {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    mainWindow.webContents.send('job-progress', { 
      jobId, 
      progress 
    });
  }
}

/**
 * Restart a failed job
 */
async function restartJob(jobId) {
  try {
    const job = getJobById(jobId);
    
    if (!job) {
      throw new Error(`Job with id ${jobId} not found`);
    }
    
    if (job.status !== 'failed') {
      throw new Error(`Job with id ${jobId} is not in failed status`);
    }
    
    // Increment retries counter
    updateJobStatus(jobId, 'queued', { 
      retries: job.retries + 1,
      error_message: null 
    });
    
    notifyJobStatusChange(jobId, 'queued');
    
    console.log(`Job ${jobId} restarted`);
    
    return true;
  } catch (error) {
    console.error(`Error restarting job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Get information about available GPUs
 */
async function getGpuInfo() {
  try {
    // For Windows, we would use a native module to detect GPUs
    // This is a simplified version that assumes the presence
    // of Intel Arc if the platform is Windows
    // In a real implementation, we would use something like node-gpu or a custom native module
    
    const isWindows = process.platform === 'win32';
    
    return {
      hasIntelArc: isWindows, // Simplified detection for demo purposes
      platform: process.platform,
      details: {
        name: 'Intel Arc GPU',
        driver: 'Latest Intel Graphics Driver',
        supportedEncoders: ['h264_qsv', 'hevc_qsv']
      }
    };
  } catch (error) {
    console.error('Error getting GPU info:', error);
    return {
      hasIntelArc: false,
      error: error.message
    };
  }
}

/**
 * Pause the encoding queue
 */
function pauseQueue() {
  isQueuePaused = true;
  console.log('Encoding queue paused');
  
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    mainWindow.webContents.send('queue-status', { paused: true });
  }
  
  return { paused: true };
}

/**
 * Resume the encoding queue
 */
function resumeQueue() {
  isQueuePaused = false;
  console.log('Encoding queue resumed');
  
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    mainWindow.webContents.send('queue-status', { paused: false });
  }
  
  // Immediately try to process the queue
  processEncodingQueue();
  
  return { paused: false };
}

/**
 * Set maximum parallel jobs
 */
function setMaxParallelJobs(count) {
  maxParallelJobs = Math.max(1, count);
  console.log(`Max parallel jobs set to ${maxParallelJobs}`);
  return maxParallelJobs;
}

/**
 * Get all encoding jobs for the UI
 */
function getEncodingQueue() {
  // Get jobs by different statuses
  const processing = getJobsByStatus('processing');
  const queued = getJobsByStatus('queued');
  const completed = getJobsByStatus('completed', 10);
  const failed = getJobsByStatus('failed');
  
  return {
    processing,
    queued,
    completed,
    failed,
    paused: isQueuePaused,
    maxParallelJobs
  };
}

/**
 * Search for jobs matching a query
 */
function searchJobs(query) {
  const { searchJobs: dbSearchJobs } = require('./database');
  return dbSearchJobs(query);
}

module.exports = {
  initializeEncoder,
  restartJob,
  getGpuInfo,
  pauseQueue,
  resumeQueue,
  setMaxParallelJobs,
  getEncodingQueue,
  searchJobs
}; 