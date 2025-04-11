const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');

let db;

/**
 * Initialize the database connection and create tables if they don't exist
 */
async function initializeDatabase() {
  const dbDir = path.join(process.cwd(), 'database');
  await fs.ensureDir(dbDir);
  
  const dbPath = path.join(dbDir, 'encoder.db');
  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create tables
  createMediaTable();
  createEncodingJobsTable();
  createScheduleTable();
  
  return db;
}

/**
 * Create the media table to store information about media files
 */
function createMediaTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      episode_name TEXT,
      directory TEXT NOT NULL,
      file_path TEXT NOT NULL UNIQUE,
      file_size_bytes INTEGER NOT NULL,
      encoding_type TEXT NOT NULL,
      media_type TEXT NOT NULL,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      needs_encoding BOOLEAN DEFAULT FALSE,
      encoded_previously BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Create the encoding jobs table to track encoding jobs
 */
function createEncodingJobsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS encoding_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      media_id INTEGER NOT NULL,
      status TEXT NOT NULL, 
      priority INTEGER DEFAULT 0,
      temp_file_path TEXT,
      original_size_bytes INTEGER NOT NULL,
      new_size_bytes INTEGER,
      size_reduction_percent REAL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      error_message TEXT,
      retries INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (media_id) REFERENCES media (id) ON DELETE CASCADE
    )
  `);
}

/**
 * Create the schedule table to store encoding schedule settings
 */
function createScheduleTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      days_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      max_parallel_jobs INTEGER DEFAULT 1,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Insert default schedule if none exists
  const count = db.prepare('SELECT COUNT(*) as count FROM schedule').get();
  if (count.count === 0) {
    db.prepare(`
      INSERT INTO schedule (days_of_week, start_time, end_time, max_parallel_jobs)
      VALUES (?, ?, ?, ?)
    `).run('0,1,2,3,4,5,6', '00:00', '23:59', 2);
  }
}

/**
 * Add a media file to the database
 */
function addMedia(mediaInfo) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO media (
      title, 
      episode_name, 
      directory, 
      file_path, 
      file_size_bytes, 
      encoding_type, 
      media_type,
      needs_encoding,
      last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  
  const needsEncoding = !['hevc', 'h265', 'av1'].includes(mediaInfo.encoding_type.toLowerCase());
  
  const info = stmt.run(
    mediaInfo.title,
    mediaInfo.episode_name || null,
    mediaInfo.directory,
    mediaInfo.file_path,
    mediaInfo.file_size_bytes,
    mediaInfo.encoding_type,
    mediaInfo.media_type,
    needsEncoding ? 1 : 0
  );
  
  return info.lastInsertRowid;
}

/**
 * Get all media that needs encoding
 */
function getMediaNeedingEncoding(limit = 100, offset = 0) {
  return db.prepare(`
    SELECT * FROM media 
    WHERE needs_encoding = 1
    ORDER BY file_size_bytes DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
}

/**
 * Create an encoding job for media
 */
function createEncodingJob(mediaId, priority = 0) {
  const media = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId);
  if (!media) {
    throw new Error(`Media with id ${mediaId} not found`);
  }
  
  const stmt = db.prepare(`
    INSERT INTO encoding_jobs (
      media_id, 
      status, 
      priority,
      original_size_bytes
    ) VALUES (?, ?, ?, ?)
  `);
  
  const info = stmt.run(
    mediaId,
    'queued',
    priority,
    media.file_size_bytes
  );
  
  return info.lastInsertRowid;
}

/**
 * Update encoding job status
 */
function updateJobStatus(jobId, status, data = {}) {
  const updates = Object.entries(data).map(([key, value]) => `${key} = ?`).join(', ');
  const values = Object.values(data);
  
  const sql = `
    UPDATE encoding_jobs 
    SET status = ?, ${updates ? updates + ', ' : ''} 
    ${status === 'completed' ? 'completed_at = CURRENT_TIMESTAMP' : 
      status === 'processing' ? 'started_at = CURRENT_TIMESTAMP' : ''}
    WHERE id = ?
  `;
  
  return db.prepare(sql).run(status, ...values, jobId);
}

/**
 * Mark media as encoded
 */
function markMediaAsEncoded(mediaId, newEncodingType, newSizeBytes) {
  return db.prepare(`
    UPDATE media 
    SET needs_encoding = 0, 
        encoded_previously = 1, 
        encoding_type = ?,
        file_size_bytes = ?,
        last_updated = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newEncodingType, newSizeBytes, mediaId);
}

/**
 * Get encoding jobs with specified status
 */
function getJobsByStatus(status, limit = 20) {
  return db.prepare(`
    SELECT j.*, m.title, m.episode_name, m.file_path, m.encoding_type
    FROM encoding_jobs j
    JOIN media m ON j.media_id = m.id
    WHERE j.status = ?
    ORDER BY j.priority DESC, j.created_at ASC
    LIMIT ?
  `).all(status, limit);
}

/**
 * Search for encoding jobs
 */
function searchJobs(query, limit = 50) {
  const searchTerm = `%${query}%`;
  return db.prepare(`
    SELECT j.*, m.title, m.episode_name, m.file_path, m.encoding_type
    FROM encoding_jobs j
    JOIN media m ON j.media_id = m.id
    WHERE m.title LIKE ? 
       OR m.episode_name LIKE ? 
       OR m.file_path LIKE ?
       OR j.status LIKE ?
    ORDER BY j.created_at DESC
    LIMIT ?
  `).all(searchTerm, searchTerm, searchTerm, searchTerm, limit);
}

/**
 * Get encoding job by ID
 */
function getJobById(jobId) {
  return db.prepare(`
    SELECT j.*, m.title, m.episode_name, m.file_path, m.encoding_type
    FROM encoding_jobs j
    JOIN media m ON j.media_id = m.id
    WHERE j.id = ?
  `).get(jobId);
}

/**
 * Get pending jobs count
 */
function getPendingJobsCount() {
  return db.prepare(`
    SELECT COUNT(*) as count FROM encoding_jobs 
    WHERE status IN ('queued', 'processing')
  `).get().count;
}

module.exports = {
  initializeDatabase,
  addMedia,
  getMediaNeedingEncoding,
  createEncodingJob,
  updateJobStatus,
  markMediaAsEncoded,
  getJobsByStatus,
  searchJobs,
  getJobById,
  getPendingJobsCount
}; 