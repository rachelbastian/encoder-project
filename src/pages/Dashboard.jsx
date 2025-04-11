import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Dashboard({ queueInfo, isLoading }) {
  const [gpuInfo, setGpuInfo] = useState(null);
  const [scanPath, setScanPath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  
  useEffect(() => {
    // Get GPU information
    const getGpuInfo = async () => {
      try {
        const info = await window.api.getGpuInfo();
        setGpuInfo(info);
      } catch (error) {
        console.error('Error getting GPU info:', error);
      }
    };
    
    getGpuInfo();
    
    // Set up scan progress listener
    const unsubscribeScanProgress = window.api.onScanProgress((data) => {
      setScanProgress(data);
    });
    
    return () => {
      unsubscribeScanProgress();
    };
  }, []);
  
  const startScan = async () => {
    if (!scanPath.trim()) {
      alert('Please enter a valid path to scan');
      return;
    }
    
    try {
      setIsScanning(true);
      setScanProgress(null);
      
      const results = await window.api.startScan(scanPath);
      
      setIsScanning(false);
      setScanProgress({
        completed: true,
        results
      });
    } catch (error) {
      console.error('Error starting scan:', error);
      setIsScanning(false);
      setScanProgress({
        error: error.message || 'Unknown error'
      });
    }
  };

  // Calculate summary numbers
  const totalJobs = queueInfo.processing.length + queueInfo.queued.length + 
                     queueInfo.completed.length + queueInfo.failed.length;
  
  // Format bytes to human readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  };
  
  // Calculate total size reduction
  const calculateSizeReduction = () => {
    let originalSize = 0;
    let newSize = 0;
    
    queueInfo.completed.forEach(job => {
      originalSize += job.original_size_bytes || 0;
      newSize += job.new_size_bytes || 0;
    });
    
    const reduction = originalSize - newSize;
    const percentage = originalSize > 0 ? (reduction / originalSize) * 100 : 0;
    
    return {
      original: formatBytes(originalSize),
      new: formatBytes(newSize),
      reduction: formatBytes(reduction),
      percentage: percentage.toFixed(2)
    };
  };
  
  const sizeReduction = calculateSizeReduction();

  // Show loading state
  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      
      {/* Summary Cards */}
      <div className="grid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Queue Status</h3>
          </div>
          <div className="card-body">
            <p><strong>Status:</strong> {queueInfo.paused ? 'Paused' : 'Active'}</p>
            <p><strong>Processing:</strong> {queueInfo.processing.length}</p>
            <p><strong>Queued:</strong> {queueInfo.queued.length}</p>
            <p><strong>Completed:</strong> {queueInfo.completed.length}</p>
            <p><strong>Failed:</strong> {queueInfo.failed.length}</p>
            <p><strong>Total Jobs:</strong> {totalJobs}</p>
            <div className="card-actions">
              <Link to="/queue" className="btn btn-primary">View Queue</Link>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Size Reduction</h3>
          </div>
          <div className="card-body">
            <p><strong>Original Size:</strong> {sizeReduction.original}</p>
            <p><strong>New Size:</strong> {sizeReduction.new}</p>
            <p><strong>Space Saved:</strong> {sizeReduction.reduction}</p>
            <p><strong>Reduction:</strong> {sizeReduction.percentage}%</p>
          </div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Hardware</h3>
          </div>
          <div className="card-body">
            {gpuInfo ? (
              <>
                <p><strong>Platform:</strong> {gpuInfo.platform}</p>
                <p><strong>Intel Arc Available:</strong> {gpuInfo.hasIntelArc ? 'Yes' : 'No'}</p>
                {gpuInfo.hasIntelArc && gpuInfo.details && (
                  <>
                    <p><strong>GPU:</strong> {gpuInfo.details.name}</p>
                    <p><strong>Driver:</strong> {gpuInfo.details.driver}</p>
                  </>
                )}
                <p><strong>Max Parallel Jobs:</strong> {queueInfo.maxParallelJobs}</p>
              </>
            ) : (
              <p>Loading hardware information...</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Scan Library Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Scan Media Library</h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label htmlFor="scan-path">Plex Library Path</label>
            <div className="scan-input-group">
              <input 
                type="text"
                id="scan-path"
                className="form-control"
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
                placeholder="Enter path to your Plex media library"
              />
              <button 
                className="btn btn-primary"
                onClick={startScan}
                disabled={isScanning || !scanPath.trim()}
              >
                {isScanning ? 'Scanning...' : 'Start Scan'}
              </button>
            </div>
          </div>
          
          {scanProgress && (
            <div className="scan-progress">
              {scanProgress.error ? (
                <div className="error-message">
                  <p>Error: {scanProgress.error}</p>
                </div>
              ) : scanProgress.completed ? (
                <div className="success-message">
                  <p>Scan completed successfully!</p>
                  <p>Scanned {scanProgress.results.scanned} files</p>
                  <p>Added {scanProgress.results.added} files to database</p>
                  <p>Found {scanProgress.results.needsEncoding} files that need encoding</p>
                </div>
              ) : (
                <div className="progress-info">
                  <p>Scanning: {scanProgress.currentFile}</p>
                  <p>Files Scanned: {scanProgress.totalScanned}</p>
                  <p>Files Added: {scanProgress.added}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Recent Jobs Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Jobs</h3>
          <Link to="/jobs" className="btn btn-sm btn-primary">View All</Link>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Status</th>
                <th>Size Reduction</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {queueInfo.completed.slice(0, 5).map(job => (
                <tr key={job.id}>
                  <td>{job.id}</td>
                  <td>{job.title}{job.episode_name ? ` - ${job.episode_name}` : ''}</td>
                  <td>
                    <span className="status status-completed">Completed</span>
                  </td>
                  <td>
                    {job.size_reduction_percent ? 
                      `${job.size_reduction_percent.toFixed(2)}%` : 
                      'N/A'}
                  </td>
                  <td>
                    {job.completed_at ? new Date(job.completed_at).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
              {queueInfo.completed.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center">No completed jobs yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

 