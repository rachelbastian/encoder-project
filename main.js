const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { initializeDatabase } = require('./src/services/database');
const { initializeScanner } = require('./src/services/scanner');
const { initializeEncoder } = require('./src/services/encoder');
const { initializeScheduler } = require('./src/services/scheduler');

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialize core services
  try {
    await initializeDatabase();
    await initializeScanner();
    await initializeEncoder();
    await initializeScheduler();
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
  }
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for communication with renderer
ipcMain.handle('get-encoding-queue', async () => {
  const { getEncodingQueue } = require('./src/services/encoder');
  return await getEncodingQueue();
});

ipcMain.handle('start-scan', async (_, libraryPath) => {
  const { scanLibrary } = require('./src/services/scanner');
  return await scanLibrary(libraryPath);
});

ipcMain.handle('get-gpu-info', async () => {
  const { getGpuInfo } = require('./src/services/encoder');
  return await getGpuInfo();
});

ipcMain.handle('restart-job', async (_, jobId) => {
  const { restartJob } = require('./src/services/encoder');
  return await restartJob(jobId);
});

ipcMain.handle('set-schedule', async (_, schedule) => {
  const { setSchedule } = require('./src/services/scheduler');
  return await setSchedule(schedule);
});

ipcMain.handle('pause-queue', async () => {
  const { pauseQueue } = require('./src/services/encoder');
  return await pauseQueue();
});

ipcMain.handle('resume-queue', async () => {
  const { resumeQueue } = require('./src/services/encoder');
  return await resumeQueue();
});

ipcMain.handle('search-jobs', async (_, query) => {
  const { searchJobs } = require('./src/services/encoder');
  return await searchJobs(query);
}); 