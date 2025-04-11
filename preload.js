const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Queue and Encoding Functions
    getEncodingQueue: () => ipcRenderer.invoke('get-encoding-queue'),
    restartJob: (jobId) => ipcRenderer.invoke('restart-job', jobId),
    pauseQueue: () => ipcRenderer.invoke('pause-queue'),
    resumeQueue: () => ipcRenderer.invoke('resume-queue'),
    searchJobs: (query) => ipcRenderer.invoke('search-jobs', query),
    
    // Scanner Functions
    startScan: (libraryPath) => ipcRenderer.invoke('start-scan', libraryPath),
    
    // GPU Information
    getGpuInfo: () => ipcRenderer.invoke('get-gpu-info'),
    
    // Scheduler Functions
    setSchedule: (schedule) => ipcRenderer.invoke('set-schedule', schedule),
    
    // Event handlers
    onQueueUpdate: (callback) => {
      const channel = 'queue-update';
      const subscription = (_event, data) => callback(data);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
    
    onScanProgress: (callback) => {
      const channel = 'scan-progress';
      const subscription = (_event, data) => callback(data);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
    
    onJobStatusChange: (callback) => {
      const channel = 'job-status-change';
      const subscription = (_event, data) => callback(data);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
    
    onError: (callback) => {
      const channel = 'error';
      const subscription = (_event, data) => callback(data);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  }
); 