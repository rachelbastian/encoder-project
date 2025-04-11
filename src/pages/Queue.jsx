import React, { useState, useEffect } from 'react';

function Queue({ queueInfo, isLoading, onRefresh }) {
  const [jobProgress, setJobProgress] = useState({});
  
  useEffect(() => {
    // Set up job progress listener
    const unsubscribeJobProgress = window.api.onJobProgress((data) => {
      setJobProgress(prev => ({
        ...prev,
        [data.jobId]: data.progress
      }));
    });
    
    return () => {
      unsubscribeJobProgress();
    };
  }, []);
  
  const restartJob = async (jobId) => {
    try {
      await window.api.restartJob(jobId);
      onRefresh();
    } catch (error) {
      console.error(`Error restarting job ${jobId}:`, error);
      alert(`Failed to restart job: ${error.message}`);
    }
  };
  
  // Format bytes to human readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="queue-page">
      <h2>Encoding Queue</h2>
      
      {/* Processing Jobs */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Processing ({queueInfo.processing.length})</h3>
        </div>
        <div className="card-body">
          {queueInfo.processing.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Original Format</th>
                  <th>Size</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {queueInfo.processing.map(job => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>{job.title}{job.episode_name ? ` - ${job.episode_name}` : ''}</td>
                    <td>{job.encoding_type}</td>
                    <td>{formatBytes(job.original_size_bytes)}</td>
                    <td>
                      <div className="progress">
                        <div 
                          className="progress-bar" 
                          style={{ width: '50%' }} // We don't have real progress % yet
                        ></div>
                      </div>
                      <div className="progress-text">
                        {jobProgress[job.id]?.time || 'Processing...'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No jobs currently processing</p>
          )}
        </div>
      </div>
      
      {/* Queued Jobs */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Queued ({queueInfo.queued.length})</h3>
        </div>
        <div className="card-body">
          {queueInfo.queued.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Original Format</th>
                  <th>Size</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {queueInfo.queued.map(job => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>{job.title}{job.episode_name ? ` - ${job.episode_name}` : ''}</td>
                    <td>{job.encoding_type}</td>
                    <td>{formatBytes(job.original_size_bytes)}</td>
                    <td>{job.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No jobs in queue</p>
          )}
        </div>
      </div>
      
      {/* Failed Jobs */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Failed ({queueInfo.failed.length})</h3>
        </div>
        <div className="card-body">
          {queueInfo.failed.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Error</th>
                  <th>Retries</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queueInfo.failed.map(job => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>{job.title}{job.episode_name ? ` - ${job.episode_name}` : ''}</td>
                    <td className="error-text">{job.error_message?.substring(0, 100) || 'Unknown error'}</td>
                    <td>{job.retries}</td>
                    <td>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => restartJob(job.id)}
                      >
                        Restart
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No failed jobs</p>
          )}
        </div>
      </div>
      
      {/* Recently Completed Jobs */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recently Completed ({queueInfo.completed.length})</h3>
        </div>
        <div className="card-body">
          {queueInfo.completed.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Original Size</th>
                  <th>New Size</th>
                  <th>Reduction</th>
                </tr>
              </thead>
              <tbody>
                {queueInfo.completed.map(job => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>{job.title}{job.episode_name ? ` - ${job.episode_name}` : ''}</td>
                    <td>{formatBytes(job.original_size_bytes)}</td>
                    <td>{formatBytes(job.new_size_bytes)}</td>
                    <td>
                      {job.size_reduction_percent ? 
                        `${job.size_reduction_percent.toFixed(2)}%` : 
                        'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No completed jobs</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Queue; 