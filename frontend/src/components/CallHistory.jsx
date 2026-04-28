import { useState, useEffect } from 'react';

const BACKEND_URL = 'https://business-voip.onrender.com';   // Change this when needed

function CallHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch call logs
  const fetchCallLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${BACKEND_URL}/api/calls/logs`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch call history');
      }

      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Error fetching call logs:', err);
      setError(err.message || 'Failed to load call history');
    } finally {
      setLoading(false);
    }
  };

  // Load data when component mounts
  useEffect(() => {
    fetchCallLogs();
  }, []);

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0s';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white">Call History</h2>
        <button 
          onClick={fetchCallLogs}
          disabled={loading}
          className="px-5 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white rounded-xl text-sm transition flex items-center gap-2"
        >
          {loading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      {loading && (
        <p className="text-gray-400 text-center py-20">Loading call history...</p>
      )}

      {error && (
        <p className="text-red-500 text-center py-10">{error}</p>
      )}

      {!loading && !error && logs.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-xl">No calls recorded yet.</p>
          <p className="text-gray-500 mt-2">Make some calls to see history here.</p>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-3xl overflow-hidden">
          {logs.map((log, index) => (
            <div 
              key={index} 
              className="border-b border-gray-700 p-6 hover:bg-gray-800 transition flex justify-between items-center"
            >
              <div>
                <p className="text-lg font-medium text-white">{log.phoneNumber}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {formatDate(log.startedAt)}
                </p>
              </div>

              <div className="text-right">
                <p className={`font-medium capitalize ${
                  log.status === 'completed' ? 'text-green-400' : 
                  log.status === 'missed' || log.status === 'no-answer' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {log.status}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {formatDuration(log.duration)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CallHistory;