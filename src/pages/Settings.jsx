import React, { useState, useEffect } from 'react';

function Settings({ onRefresh }) {
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [formData, setFormData] = useState({
    days_of_week: '0,1,2,3,4,5,6',
    start_time: '00:00',
    end_time: '23:59',
    max_parallel_jobs: 2,
    active: true
  });
  
  // Days of week options
  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];
  
  useEffect(() => {
    loadSchedules();
    
    // Set up schedule status listener
    const unsubscribeScheduleStatus = window.api.onScheduleStatus && window.api.onScheduleStatus((data) => {
      loadSchedules();
    });
    
    return () => {
      if (unsubscribeScheduleStatus) {
        unsubscribeScheduleStatus();
      }
    };
  }, []);
  
  const loadSchedules = async () => {
    try {
      setIsLoading(true);
      // Mock data for now since we haven't implemented the full API yet
      // In a real implementation, we would call: const data = await window.api.getSchedules();
      
      const mockSchedules = [
        {
          id: 1,
          days_of_week: '0,1,2,3,4,5,6',
          start_time: '22:00',
          end_time: '06:00',
          max_parallel_jobs: 3,
          active: true
        }
      ];
      
      setSchedules(mockSchedules);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading schedules:', error);
      setIsLoading(false);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'days_of_week') {
      // For the multi-select days of week
      const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);
      setFormData(prev => ({ ...prev, [name]: selectedOptions.join(',') }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule.id);
    setFormData({
      days_of_week: schedule.days_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      max_parallel_jobs: schedule.max_parallel_jobs,
      active: schedule.active
    });
  };
  
  const handleCancelEdit = () => {
    setEditingSchedule(null);
    setFormData({
      days_of_week: '0,1,2,3,4,5,6',
      start_time: '00:00',
      end_time: '23:59',
      max_parallel_jobs: 2,
      active: true
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      
      // For a real implementation
      // const updatedSchedule = await window.api.setSchedule({
      //   id: editingSchedule,
      //   ...formData
      // });
      
      // Mock update for now
      const updatedSchedules = schedules.map(schedule => {
        if (schedule.id === editingSchedule) {
          return { ...schedule, ...formData };
        }
        return schedule;
      });
      
      setSchedules(updatedSchedules);
      setEditingSchedule(null);
      setFormData({
        days_of_week: '0,1,2,3,4,5,6',
        start_time: '00:00',
        end_time: '23:59',
        max_parallel_jobs: 2,
        active: true
      });
      
      if (onRefresh) {
        onRefresh();
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error saving schedule:', error);
      setIsLoading(false);
      alert(`Error saving schedule: ${error.message}`);
    }
  };
  
  const toggleScheduleStatus = async (scheduleId, currentActive) => {
    try {
      setIsLoading(true);
      
      // For a real implementation
      // await window.api.setScheduleStatus(scheduleId, !currentActive);
      
      // Mock update for now
      const updatedSchedules = schedules.map(schedule => {
        if (schedule.id === scheduleId) {
          return { ...schedule, active: !currentActive };
        }
        return schedule;
      });
      
      setSchedules(updatedSchedules);
      
      if (onRefresh) {
        onRefresh();
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error(`Error toggling schedule status for ${scheduleId}:`, error);
      setIsLoading(false);
      alert(`Error toggling schedule status: ${error.message}`);
    }
  };
  
  // Format day names from values
  const formatDays = (daysString) => {
    if (!daysString) return 'None';
    
    const dayValues = daysString.split(',').map(Number);
    return dayValues.map(value => {
      const day = daysOfWeek.find(d => d.value === value);
      return day ? day.label : '';
    }).join(', ');
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
    <div className="settings-page">
      <h2>Settings</h2>
      
      {/* Encoding Schedules */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Encoding Schedules</h3>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>Days</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Max Jobs</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(schedule => (
                <tr key={schedule.id}>
                  <td>{formatDays(schedule.days_of_week)}</td>
                  <td>{schedule.start_time}</td>
                  <td>{schedule.end_time}</td>
                  <td>{schedule.max_parallel_jobs}</td>
                  <td>
                    <span className={`status ${schedule.active ? 'status-completed' : 'status-failed'}`}>
                      {schedule.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => handleEditSchedule(schedule)}
                      style={{ marginRight: '8px' }}
                    >
                      Edit
                    </button>
                    <button 
                      className={`btn btn-sm ${schedule.active ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => toggleScheduleStatus(schedule.id, schedule.active)}
                    >
                      {schedule.active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center">No schedules configured</td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* Edit Schedule Form */}
          {editingSchedule !== null && (
            <div className="schedule-form">
              <h4>Edit Schedule</h4>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="days_of_week">Days of Week:</label>
                  <select 
                    id="days_of_week"
                    name="days_of_week"
                    className="form-control"
                    multiple
                    value={formData.days_of_week.split(',')}
                    onChange={handleInputChange}
                  >
                    {daysOfWeek.map(day => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                  <small>Hold Ctrl/Cmd to select multiple days</small>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="start_time">Start Time:</label>
                    <input 
                      type="time"
                      id="start_time"
                      name="start_time"
                      className="form-control"
                      value={formData.start_time}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="end_time">End Time:</label>
                    <input 
                      type="time"
                      id="end_time"
                      name="end_time"
                      className="form-control"
                      value={formData.end_time}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="max_parallel_jobs">Max Parallel Jobs:</label>
                  <input 
                    type="number"
                    id="max_parallel_jobs"
                    name="max_parallel_jobs"
                    className="form-control"
                    min="1"
                    max="16"
                    value={formData.max_parallel_jobs}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="form-group">
                  <label>
                    <input 
                      type="checkbox"
                      name="active"
                      checked={formData.active}
                      onChange={handleInputChange}
                    />
                    Active
                  </label>
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    Save Schedule
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
      
      {/* Encoding Settings */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Encoding Settings</h3>
        </div>
        <div className="card-body">
          <p>These settings control how files are encoded.</p>
          
          {/* In a real implementation, we would have more settings here */}
          <div className="encoding-settings">
            <div className="form-group">
              <label>Target Format:</label>
              <select className="form-control" disabled>
                <option>HEVC (H.265) 10-bit</option>
              </select>
              <small>Currently, only HEVC 10-bit is supported</small>
            </div>
            
            <div className="form-group">
              <label>Hardware Acceleration:</label>
              <select className="form-control" disabled>
                <option>Intel QSV (Arc GPU)</option>
              </select>
              <small>Hardware acceleration is automatically detected</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings; 