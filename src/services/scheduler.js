const path = require('path');
const fs = require('fs-extra');
const schedule = require('node-schedule');
const Database = require('better-sqlite3');
const { BrowserWindow } = require('electron');
const { setMaxParallelJobs, pauseQueue, resumeQueue } = require('./encoder');

// Store all schedules
let scheduleJobs = {};
let db;

/**
 * Initialize the scheduler service
 */
async function initializeScheduler() {
  try {
    const dbPath = path.join(process.cwd(), 'database', 'encoder.db');
    db = new Database(dbPath);
    
    // Load schedules and set them up
    await loadSchedules();
    
    console.log('Scheduler service initialized');
    return true;
  } catch (error) {
    console.error('Error initializing scheduler:', error);
    throw error;
  }
}

/**
 * Load schedules from database and set them up
 */
async function loadSchedules() {
  try {
    const schedules = db.prepare('SELECT * FROM schedule WHERE active = 1').all();
    
    for (const scheduleItem of schedules) {
      setUpSchedule(scheduleItem);
    }
    
    console.log(`Loaded ${schedules.length} schedules`);
    return schedules;
  } catch (error) {
    console.error('Error loading schedules:', error);
    throw error;
  }
}

/**
 * Set up a schedule in node-schedule
 */
function setUpSchedule(scheduleItem) {
  try {
    const { id, days_of_week, start_time, end_time, max_parallel_jobs } = scheduleItem;
    
    // Cancel existing schedule if any
    if (scheduleJobs[id]) {
      scheduleJobs[id].start.cancel();
      scheduleJobs[id].end.cancel();
      delete scheduleJobs[id];
    }
    
    const daysArray = days_of_week.split(',').map(Number);
    const [startHour, startMinute] = start_time.split(':').map(Number);
    const [endHour, endMinute] = end_time.split(':').map(Number);
    
    // Set up start schedule
    const startRule = new schedule.RecurrenceRule();
    startRule.dayOfWeek = daysArray;
    startRule.hour = startHour;
    startRule.minute = startMinute;
    
    const startJob = schedule.scheduleJob(startRule, function() {
      console.log(`Schedule ${id} starting: setting max parallel jobs to ${max_parallel_jobs}`);
      resumeQueue();
      setMaxParallelJobs(max_parallel_jobs);
      
      // Notify UI
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('schedule-status', { 
          id,
          status: 'active',
          maxJobs: max_parallel_jobs
        });
      }
    });
    
    // Set up end schedule
    const endRule = new schedule.RecurrenceRule();
    endRule.dayOfWeek = daysArray;
    endRule.hour = endHour;
    endRule.minute = endMinute;
    
    const endJob = schedule.scheduleJob(endRule, function() {
      console.log(`Schedule ${id} ending: pausing queue`);
      pauseQueue();
      
      // Notify UI
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('schedule-status', { 
          id,
          status: 'inactive'
        });
      }
    });
    
    // Store jobs for future reference
    scheduleJobs[id] = {
      start: startJob,
      end: endJob
    };
    
    // Check if we should be active right now
    checkIfScheduleShouldBeActive(scheduleItem);
    
    console.log(`Set up schedule ${id}`);
    return true;
  } catch (error) {
    console.error(`Error setting up schedule ${scheduleItem.id}:`, error);
    throw error;
  }
}

/**
 * Check if a schedule should be active right now and apply settings
 */
function checkIfScheduleShouldBeActive(scheduleItem) {
  const { id, days_of_week, start_time, end_time, max_parallel_jobs } = scheduleItem;
  
  const now = new Date();
  const day = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const daysArray = days_of_week.split(',').map(Number);
  
  // Check if current day is in schedule
  if (daysArray.includes(day)) {
    // Check if current time is between start and end
    if (currentTime >= start_time && currentTime <= end_time) {
      console.log(`Schedule ${id} is active now: setting max parallel jobs to ${max_parallel_jobs}`);
      resumeQueue();
      setMaxParallelJobs(max_parallel_jobs);
      
      // Notify UI
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('schedule-status', { 
          id,
          status: 'active',
          maxJobs: max_parallel_jobs
        });
      }
    } else {
      console.log(`Schedule ${id} is not active now: time outside range`);
      pauseQueue();
    }
  } else {
    console.log(`Schedule ${id} is not active now: day not in schedule`);
    pauseQueue();
  }
}

/**
 * Get all schedules
 */
function getSchedules() {
  try {
    return db.prepare('SELECT * FROM schedule').all();
  } catch (error) {
    console.error('Error getting schedules:', error);
    throw error;
  }
}

/**
 * Create a new schedule
 */
function createSchedule(scheduleData) {
  try {
    const { days_of_week, start_time, end_time, max_parallel_jobs } = scheduleData;
    
    const stmt = db.prepare(`
      INSERT INTO schedule (days_of_week, start_time, end_time, max_parallel_jobs, active)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      days_of_week,
      start_time,
      end_time,
      max_parallel_jobs || 2,
      1
    );
    
    const newSchedule = db.prepare('SELECT * FROM schedule WHERE id = ?').get(info.lastInsertRowid);
    
    // Set up the new schedule
    setUpSchedule(newSchedule);
    
    return newSchedule;
  } catch (error) {
    console.error('Error creating schedule:', error);
    throw error;
  }
}

/**
 * Update an existing schedule
 */
function updateSchedule(id, scheduleData) {
  try {
    const { days_of_week, start_time, end_time, max_parallel_jobs, active } = scheduleData;
    
    const stmt = db.prepare(`
      UPDATE schedule 
      SET days_of_week = ?, 
          start_time = ?, 
          end_time = ?, 
          max_parallel_jobs = ?,
          active = ?
      WHERE id = ?
    `);
    
    stmt.run(
      days_of_week,
      start_time,
      end_time,
      max_parallel_jobs,
      active,
      id
    );
    
    const updatedSchedule = db.prepare('SELECT * FROM schedule WHERE id = ?').get(id);
    
    // Cancel old schedule and set up updated one if active
    if (updatedSchedule.active) {
      setUpSchedule(updatedSchedule);
    } else if (scheduleJobs[id]) {
      // Cancel if set to inactive
      scheduleJobs[id].start.cancel();
      scheduleJobs[id].end.cancel();
      delete scheduleJobs[id];
    }
    
    return updatedSchedule;
  } catch (error) {
    console.error(`Error updating schedule ${id}:`, error);
    throw error;
  }
}

/**
 * Delete a schedule
 */
function deleteSchedule(id) {
  try {
    // Cancel scheduled jobs if exist
    if (scheduleJobs[id]) {
      scheduleJobs[id].start.cancel();
      scheduleJobs[id].end.cancel();
      delete scheduleJobs[id];
    }
    
    db.prepare('DELETE FROM schedule WHERE id = ?').run(id);
    return { success: true, id };
  } catch (error) {
    console.error(`Error deleting schedule ${id}:`, error);
    throw error;
  }
}

/**
 * Manually set a schedule status (active/inactive)
 */
function setScheduleStatus(id, active) {
  try {
    db.prepare('UPDATE schedule SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
    
    const schedule = db.prepare('SELECT * FROM schedule WHERE id = ?').get(id);
    
    if (active) {
      setUpSchedule(schedule);
    } else if (scheduleJobs[id]) {
      // Cancel if set to inactive
      scheduleJobs[id].start.cancel();
      scheduleJobs[id].end.cancel();
      delete scheduleJobs[id];
    }
    
    return schedule;
  } catch (error) {
    console.error(`Error setting schedule status for ${id}:`, error);
    throw error;
  }
}

/**
 * Set schedule from the UI
 */
function setSchedule(scheduleData) {
  try {
    if (scheduleData.id) {
      return updateSchedule(scheduleData.id, scheduleData);
    } else {
      return createSchedule(scheduleData);
    }
  } catch (error) {
    console.error('Error setting schedule:', error);
    throw error;
  }
}

module.exports = {
  initializeScheduler,
  getSchedules,
  setSchedule,
  deleteSchedule,
  setScheduleStatus
}; 