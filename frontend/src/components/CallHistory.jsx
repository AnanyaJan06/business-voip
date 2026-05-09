import { useState, useEffect } from 'react';

const BACKEND_URL = 'https://business-voip.onrender.com';

const callStyles = {
  outbound: {
    label: 'Outbound',
    iconClass: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    statusClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
  },
  inbound: {
    label: 'Inbound',
    iconClass: 'bg-sky-500/10 text-sky-300 ring-sky-500/20',
    statusClass: 'bg-sky-500/10 text-sky-300 border-sky-500/20'
  },
  missed: {
    label: 'Missed',
    iconClass: 'bg-red-500/10 text-red-300 ring-red-500/20',
    statusClass: 'bg-red-500/10 text-red-300 border-red-500/20'
  },
  rejected: {
    label: 'Rejected',
    iconClass: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
    statusClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20'
  },
  failed: {
    label: 'Failed',
    iconClass: 'bg-rose-500/10 text-rose-300 ring-rose-500/20',
    statusClass: 'bg-rose-500/10 text-rose-300 border-rose-500/20'
  },
  default: {
    label: 'Call',
    iconClass: 'bg-gray-500/10 text-gray-300 ring-gray-500/20',
    statusClass: 'bg-gray-500/10 text-gray-300 border-gray-500/20'
  }
};

function DirectionIcon({ type }) {
  const common = {
    className: 'w-5 h-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  };

  if (type === 'outbound') {
    return (
      <svg {...common}>
        <path d="M7 17L17 7" />
        <path d="M8 7h9v9" />
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.61a2 2 0 0 1-.45 2.11L8 9.72" />
      </svg>
    );
  }

  if (type === 'missed' || type === 'rejected' || type === 'failed') {
    return (
      <svg {...common}>
        <path d="M16 2v6h6" />
        <path d="M22 2l-6 6" />
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.61a2 2 0 0 1-.45 2.11L8 9.72" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M17 7L7 17" />
      <path d="M7 8v9h9" />
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.61a2 2 0 0 1-.45 2.11L8 9.72" />
    </svg>
  );
}

function CallHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCallLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${BACKEND_URL}/api/calls/logs`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      if (!res.ok) throw new Error('Failed to load call history');
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

  useEffect(() => {
    const handler = () => fetchCallLogs();
    window.addEventListener('refreshCallHistory', handler);
    return () => window.removeEventListener('refreshCallHistory', handler);
  }, []);

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

  const formatDuration = (seconds) => {
    const secs = Number(seconds) || 0;
    if (secs === 0) return '0s';

    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatDateTime = (date) => {
    const value = new Date(date);
    return `${value.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })} at ${value.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  };

  const getCallMeta = (log) => {
    const status = log.status?.toLowerCase();
    const callType = log.callType?.toLowerCase();
    const visualType = ['missed', 'rejected', 'failed'].includes(status)
      ? status
      : callType || 'default';

    return {
      ...(callStyles[visualType] || callStyles.default),
      visualType,
      statusLabel: (status || 'unknown').replace('-', ' '),
      directionLabel: callStyles[callType]?.label || callStyles.default.label
    };
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
        {logs.map((log) => {
          const meta = getCallMeta(log);

          return (
            <div
              key={log._id || log.callSid}
              className="px-5 py-5 hover:bg-[#1F2533] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ring-1 shrink-0 ${meta.iconClass}`}>
                  <DirectionIcon type={meta.visualType} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-base text-white truncate">
                    {formatPhoneNumber(log.phoneNumber)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-400">
                    <span>{meta.directionLabel}</span>
                    <span className="text-gray-600">|</span>
                    <span>{formatDateTime(log.startedAt || log.createdAt)}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold capitalize ${meta.statusClass}`}>
                    {meta.statusLabel}
                  </span>
                  <p className="text-sm text-gray-400 mt-2 font-mono tracking-wide">
                    {formatDuration(log.duration)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CallHistory;
