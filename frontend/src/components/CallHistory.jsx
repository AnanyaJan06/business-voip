import { useState, useEffect } from 'react';

const BACKEND_URL = 'https://business-voip.onrender.com';

function CallHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCallLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/calls/logs`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallLogs();
  }, []);

  // Refresh listener
  useEffect(() => {
    const handler = () => fetchCallLogs();
    window.addEventListener('refreshCallHistory', handler);
    return () => window.removeEventListener('refreshCallHistory', handler);
  }, []);

  // Format US Phone Number
  const formatPhoneNumber = (phone) => {
    if (!phone) return 'Unknown';

    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = cleaned.slice(1);
    }

    if (cleaned.length === 10) {
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Updated formatDuration - Show 0s instead of —
  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return '0s';
    const secs = parseInt(seconds);
    if (secs === 0) return '0s';
    
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-green-500/10 text-green-400';
      case 'missed': return 'bg-red-500/10 text-red-400';
      case 'no-answer': return 'bg-yellow-500/10 text-yellow-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  return (
    <div className="flex-1 overflow-auto thin-scrollbar">
      {loading && <p className="text-gray-400 text-center py-12">Loading call history...</p>}
      {error && <p className="text-red-400 text-center py-12">{error}</p>}

      {!loading && logs.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          No calls yet. Start making calls!
        </div>
      )}

      <div className="divide-y divide-gray-800">
        {logs.map((log, i) => (
          <div
            key={i}
            className="px-6 py-6 hover:bg-[#1F2533] transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-lg text-white">
                  {formatPhoneNumber(log.phoneNumber)}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {new Date(log.startedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })} • {new Date(log.startedAt).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>

              <div className="text-right ml-4">
                <span className={`inline-block px-4 py-1 rounded-full text-xs font-medium capitalize ${getStatusStyle(log.status)}`}>
                  {log.status || 'Unknown'}
                </span>
                <p className="text-sm text-gray-400 mt-3 font-mono tracking-wide">
                  {formatDuration(log.duration)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CallHistory;