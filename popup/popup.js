// Popup script for displaying click monitor data

document.addEventListener('DOMContentLoaded', function() {
  loadStats();
  loadRecentEvents();
  
  document.getElementById('refreshBtn').addEventListener('click', function() {
    loadStats();
    loadRecentEvents();
  });
  
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('clearBtn').addEventListener('click', clearData);
});

function loadStats() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, function(response) {
    const statsContainer = document.getElementById('stats');
    
    if (response && response.success) {
      const stats = response.stats;
      statsContainer.innerHTML = `
        <div class="stat-item">
          <span class="stat-label">Total Events</span>
          <span class="stat-value">${stats.total.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Clicks</span>
          <span class="stat-value">${stats.clicks.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Mouse Downs</span>
          <span class="stat-value">${stats.mousedowns.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Avg Duration</span>
          <span class="stat-value">${Math.round(stats.avgDuration)}ms</span>
        </div>
      `;
    } else {
      statsContainer.innerHTML = '<p class="no-data">Unable to load stats</p>';
    }
  });
}

function loadRecentEvents() {
  chrome.runtime.sendMessage({ type: 'GET_EVENTS', limit: 10 }, function(response) {
    const eventsContainer = document.getElementById('events');
    
    if (response && response.success && response.events.length > 0) {
      const events = response.events.slice(-10).reverse();
      eventsContainer.innerHTML = events.map(event => `
        <div class="event-item">
          <span class="event-type ${event.eventType}">${event.eventType}</span>
          <span class="event-coords">(${event.x}, ${event.y})</span>
          ${event.duration ? `<span class="event-duration">${event.duration}ms</span>` : ''}
        </div>
      `).join('');
    } else {
      eventsContainer.innerHTML = '<p class="no-data">No events recorded yet</p>';
    }
  });
}

function exportData() {
  chrome.runtime.sendMessage({ type: 'EXPORT_EVENTS' }, function(response) {
    if (response && response.success) {
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `click-monitor-data-${new Date().toISOString().slice(0,10)}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    } else {
      alert('Failed to export data');
    }
  });
}

function clearData() {
  if (confirm('Are you sure you want to delete all recorded click data? This cannot be undone.')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_EVENTS' }, function(response) {
      if (response && response.success) {
        loadStats();
        loadRecentEvents();
      } else {
        alert('Failed to clear data');
      }
    });
  }
}
