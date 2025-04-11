import React, { useState } from 'react';

function Jobs({ onRefresh }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      alert('Please enter a search term');
      return;
    }
    
    try {
      setIsLoading(true);
      const results = await window.api.searchJobs(searchQuery);
      setSearchResults(results);
      setHasSearched(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error searching jobs:', error);
      setIsLoading(false);
      alert(`Error searching jobs: ${error.message}`);
    }
  };
  
  const restartJob = async (jobId) => {
    try {
      await window.api.restartJob(jobId);
      
      // Refresh the search results
      handleSearch({ preventDefault: () => {} });
      
      // Notify parent to refresh any related data
      if (onRefresh) {
        onRefresh();
      }
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
  
  // Get status class for styling
  const getStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'processing':
        return 'status-processing';
      case 'queued':
        return 'status-queued';
      case 'failed':
        return 'status-failed';
      default:
        return '';
    }
  };

  return (
    <div className="jobs-page">
      <h2>Search Jobs</h2>
      
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Search</h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleSearch}>
            <div className="form-group">
              <label htmlFor="search-query">Search for jobs by title, episode, file path or status:</label>
              <div className="search-input-group">
                <input 
                  type="text"
                  id="search-query"
                  className="form-control"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter search term..."
                />
                <button 
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading || !searchQuery.trim()}
                >
                  {isLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      
      {isLoading ? (
        <div className="loading">
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <>
          {hasSearched && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Search Results ({searchResults.length})</h3>
              </div>
              <div className="card-body">
                {searchResults.length > 0 ? (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Original Size</th>
                        <th>New Size</th>
                        <th>Reduction</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map(job => (
                        <tr key={job.id}>
                          <td>{job.id}</td>
                          <td>{job.title}{job.episode_name ? ` - ${job.episode_name}` : ''}</td>
                          <td>
                            <span className={`status ${getStatusClass(job.status)}`}>
                              {job.status}
                            </span>
                          </td>
                          <td>{formatBytes(job.original_size_bytes)}</td>
                          <td>{formatBytes(job.new_size_bytes)}</td>
                          <td>
                            {job.size_reduction_percent ? 
                              `${job.size_reduction_percent.toFixed(2)}%` : 
                              'N/A'}
                          </td>
                          <td>
                            {job.completed_at ? 
                              new Date(job.completed_at).toLocaleString() : 
                              job.created_at ? 
                                new Date(job.created_at).toLocaleString() : 
                                'N/A'}
                          </td>
                          <td>
                            {job.status === 'failed' && (
                              <button 
                                className="btn btn-sm btn-primary"
                                onClick={() => restartJob(job.id)}
                              >
                                Restart
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No jobs found matching "{searchQuery}"</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Jobs; 