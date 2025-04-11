import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Queue from './pages/Queue';
import Settings from './pages/Settings';
import Jobs from './pages/Jobs';
import './App.css';

function App() {
  const [queueInfo, setQueueInfo] = useState({
    processing: [],
    queued: [],
    completed: [],
    failed: [],
    paused: false
  });
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial data load
    loadQueueData();
    
    // Set up event listeners
    const unsubscribeQueueUpdate = window.api.onQueueUpdate(() => {
      loadQueueData();
    });
    
    const unsubscribeJobStatusChange = window.api.onJobStatusChange((data) => {
      loadQueueData();
    });
    
    return () => {
      unsubscribeQueueUpdate();
      unsubscribeJobStatusChange();
    };
  }, []);
  
  const loadQueueData = async () => {
    try {
      setIsLoading(true);
      const data = await window.api.getEncodingQueue();
      setQueueInfo(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading queue data:', error);
      setIsLoading(false);
    }
  };
  
  const pauseQueue = async () => {
    try {
      await window.api.pauseQueue();
      loadQueueData();
    } catch (error) {
      console.error('Error pausing queue:', error);
    }
  };
  
  const resumeQueue = async () => {
    try {
      await window.api.resumeQueue();
      loadQueueData();
    } catch (error) {
      console.error('Error resuming queue:', error);
    }
  };

  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <h1>Plex Encoder</h1>
          <nav>
            <ul>
              <li><Link to="/">Dashboard</Link></li>
              <li><Link to="/queue">Queue</Link></li>
              <li><Link to="/jobs">Jobs</Link></li>
              <li><Link to="/settings">Settings</Link></li>
            </ul>
          </nav>
          <div className="queue-controls">
            {queueInfo.paused ? (
              <button onClick={resumeQueue}>Resume Queue</button>
            ) : (
              <button onClick={pauseQueue}>Pause Queue</button>
            )}
          </div>
        </header>
        
        <main className="app-content">
          <Routes>
            <Route 
              path="/" 
              element={<Dashboard queueInfo={queueInfo} isLoading={isLoading} />} 
            />
            <Route 
              path="/queue" 
              element={<Queue queueInfo={queueInfo} isLoading={isLoading} onRefresh={loadQueueData} />} 
            />
            <Route 
              path="/jobs" 
              element={<Jobs onRefresh={loadQueueData} />} 
            />
            <Route 
              path="/settings" 
              element={<Settings onRefresh={loadQueueData} />} 
            />
          </Routes>
        </main>
        
        <footer className="app-footer">
          <p>Plex Encoder - Optimize your media library</p>
        </footer>
      </div>
    </Router>
  );
}

export default App; 