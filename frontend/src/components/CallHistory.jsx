import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  PhoneForwarded,
  MessageSquare,
  BookmarkPlus,
  Copy,
  Check,
  Clock,
  User,
  FileText,
  Search,
  X,
  ChevronRight,
  ArrowUpDown
} from 'lucide-react';
import { AppSkeletonTheme, Skeleton } from './ui/AppSkeleton.jsx';
import { buildPagedUrl, PAGE_SIZE, parsePagedResponse } from '../utils/pagination.js';
import { showCopiedNumberToast, showErrorToast, showSuccessToast } from '../utils/toast.js';
import { BACKEND_URL } from '../config/api.js';
import CallDetails from './CallDetails.jsx';

const callFilters = [
  { key: 'all', label: 'All' },
  { key: 'missed', label: 'Missed' },
  { key: 'inbound', label: 'Inbound' },
  { key: 'outbound', label: 'Outbound' }
];

const sortOptions = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' }
];

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

const formatPhoneNumber = (phone) => {
  if (!phone) return 'Unknown';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const area = cleaned.slice(1, 4);
    const mid = cleaned.slice(4, 7);
    const end = cleaned.slice(7);
    return `+1 (${area}) ${mid}-${end}`;
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

const formatRelativeTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) return timeStr;
  if (isYesterday) return `Yesterday`;

  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return d.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
};

const getCallDate = (log) => log?.startedAt || log?.createdAt;

const getCallTime = (log) => {
  const time = new Date(getCallDate(log)).getTime();
  return Number.isNaN(time) ? 0 : time;
};

function CallHistorySkeleton() {
  const rows = Array.from({ length: 9 }, (_, index) => index);

  return (
    <AppSkeletonTheme>
      <div role="status" aria-label="Loading call history">
        <div className="sticky top-0 z-10 bg-[#161B26]/95 px-3 py-2.5 backdrop-blur border-b border-gray-800 space-y-2">
          <Skeleton height={36} borderRadius={10} />
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#0F141F] p-1">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} height={28} borderRadius={8} />
            ))}
          </div>
        </div>

        <div className="p-2 sm:p-3 space-y-1.5">
          {rows.map((row) => (
            <div key={row} className="px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 bg-transparent">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Skeleton width={38} height={38} borderRadius={12} className="shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton width="48%" height={14} />
                  <Skeleton width="65%" height={11} />
                </div>
              </div>
              <Skeleton width={52} height={12} className="shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </AppSkeletonTheme>
  );
}

export default function CallHistory({
  selectedCall = null,
  onSelectCall = () => {},
  onLogsLoaded = () => {},
  onContactsLoaded = () => {}
}) {
  const [logs, setLogs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [selectedDate, setSelectedDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  // Fetch saved contacts
  const fetchContacts = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setContacts(list);
      onContactsLoaded(list);
    } catch (err) {
      console.error('Failed to load contacts for call history:', err);
    }
  }, [onContactsLoaded]);

  // Fetch call logs
  const fetchCallLogs = useCallback(async ({ reset = false, before = null } = {}) => {
    const requestId = reset ? latestRequestRef.current + 1 : latestRequestRef.current;
    if (reset) latestRequestRef.current = requestId;

    try {
      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const extraParams = { sortOrder };
      if (debouncedSearchQuery.trim()) extraParams.search = debouncedSearchQuery.trim();
      if (activeFilter !== 'all') extraParams.callType = activeFilter;
      if (selectedDate) {
        const [year, month, day] = selectedDate.split('-').map(Number);
        const dateStart = new Date(year, month - 1, day);
        const dateEnd = new Date(year, month - 1, day + 1);
        extraParams.dateStart = dateStart.toISOString();
        extraParams.dateEnd = dateEnd.toISOString();
      }

      const res = await fetch(buildPagedUrl(`${BACKEND_URL}/api/calls/logs`, {
        limit: PAGE_SIZE,
        before: sortOrder === 'newest' ? before : null,
        after: sortOrder === 'oldest' ? before : null,
        extraParams
      }), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!res.ok) throw new Error('Failed to load call history');

      const page = parsePagedResponse(await res.json());
      if (requestId !== latestRequestRef.current) return;

      setLogs((current) => {
        const nextLogs = reset ? page.items : [...current, ...page.items];
        onLogsLoaded(nextLogs);
        return nextLogs;
      });
      setHasMore(page.hasMore);
      setNextBefore(page.nextBefore);
    } catch (err) {
      if (reset && requestId === latestRequestRef.current) setError(err.message);
    } finally {
      if (requestId === latestRequestRef.current) {
        if (reset) setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeFilter, debouncedSearchQuery, onLogsLoaded, selectedDate, sortOrder]);

  const loadMoreLogs = useCallback(() => {
    if (!hasMore || loading || loadingMore || !nextBefore) return;
    fetchCallLogs({ before: nextBefore });
  }, [fetchCallLogs, hasMore, loading, loadingMore, nextBefore]);

  useEffect(() => {
    fetchCallLogs({ reset: true });
    fetchContacts();
  }, [fetchCallLogs, fetchContacts]);

  useEffect(() => {
    const handler = () => {
      fetchCallLogs({ reset: true });
      fetchContacts();
    };
    window.addEventListener('refreshCallHistory', handler);
    window.addEventListener('refreshContacts', handler);
    return () => {
      window.removeEventListener('refreshCallHistory', handler);
      window.removeEventListener('refreshContacts', handler);
    };
  }, [fetchCallLogs, fetchContacts]);

  // Map of normalized phone -> contact object
  const contactMap = useMemo(() => {
    const map = new Map();
    contacts.forEach((contact) => {
      const norm = normalizePhone(contact.phone);
      if (norm) {
        map.set(norm, contact);
      }
    });
    return map;
  }, [contacts]);

  // Search and filters are applied by the backend before pagination.
  const visibleLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const newestFirst = getCallTime(b) - getCallTime(a);
      return sortOrder === 'newest' ? newestFirst : -newestFirst;
    });
  }, [logs, sortOrder]);

  const activeFilterLabel = callFilters.find((filter) => filter.key === activeFilter)?.label || 'All';

  const handleRowClick = (log) => {
    onSelectCall(log);
    setShowMobileDetails(true);
  };

  const [copiedId, setCopiedId] = useState(null);

  const handleCall = (e, phoneNumber) => {
    e.stopPropagation();
    if (!phoneNumber) return;
    window.dispatchEvent(new CustomEvent('callContact', {
      detail: { phoneNumber }
    }));
  };

  const handleMessage = (e, phoneNumber) => {
    e.stopPropagation();
    if (!phoneNumber) return;
    window.dispatchEvent(new CustomEvent('openConversation', {
      detail: { phoneNumber }
    }));
  };

  const handleCopyNumber = async (e, phoneNumber, logId) => {
    e.stopPropagation();
    if (!phoneNumber) return;
    try {
      await navigator.clipboard.writeText(phoneNumber);
      setCopiedId(logId);
      showCopiedNumberToast({ phoneNumber: formatPhoneNumber(phoneNumber) });
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      showErrorToast('Failed to copy number');
    }
  };

  const getCallIcon = (log) => {
    const status = (log.status || '').toLowerCase();
    const callType = (log.callType || 'inbound').toLowerCase();

    if (status === 'missed' || status === 'rejected' || status === 'failed') {
      return (
        <div className="call-icon-badge call-icon-missed w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center shrink-0 ring-1 ring-red-500/25">
          <PhoneMissed className="w-4 h-4" />
        </div>
      );
    }
    if (status === 'answered-by-teammate' || log.handledByName) {
      return (
        <div className="call-icon-badge call-icon-forwarded w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 ring-1 ring-emerald-500/25">
          <PhoneForwarded className="w-4 h-4" />
        </div>
      );
    }
    if (callType === 'outbound') {
      return (
        <div className="call-icon-badge call-icon-outbound w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 ring-1 ring-emerald-500/25">
          <PhoneOutgoing className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="call-icon-badge call-icon-inbound w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0 ring-1 ring-sky-500/25">
        <PhoneIncoming className="w-4 h-4" />
      </div>
    );
  };

  const selectedCallId = selectedCall?._id || selectedCall?.callSid;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Sticky Header with Search Bar and Filters */}
      <div className="sticky top-0 z-10 bg-[#161B26]/95 px-3 py-2.5 backdrop-blur border-b border-gray-800 shrink-0 space-y-2">
        {/* Search Bar at Top */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by number or contact name..."
            className="w-full h-9 pl-9 pr-8 rounded-xl border border-gray-700 bg-[#0F141F] text-xs font-medium text-white placeholder-gray-500 transition-colors hover:border-gray-600 focus:border-emerald-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDebouncedSearchQuery('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#0F141F] p-1">
          {callFilters.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`h-7 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-400 hover:bg-[#1F2533] hover:text-white'
                }`}
                aria-pressed={isActive}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {/* Date Filter & Sort */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="sr-only" htmlFor="call-sort-order">Sort calls</label>
          <select
            id="call-sort-order"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className="h-8 rounded-lg border border-gray-700 bg-[#0F141F] px-2.5 text-xs font-medium text-white transition-colors hover:border-gray-600 focus:border-emerald-500 focus:outline-none"
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                Sort: {option.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="call-date-filter">Filter calls by date</label>
          <input
            id="call-date-filter"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="call-history-date-input h-8 rounded-lg border border-gray-700 bg-[#0F141F] px-2.5 text-xs font-medium text-white transition-colors hover:border-gray-600 focus:border-emerald-500 focus:outline-none"
          />

          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate('')}
              className="h-8 rounded-lg border border-gray-700 px-3 text-xs font-semibold text-gray-300 transition-colors hover:bg-[#1F2533] hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-2 sm:p-3 space-y-1.5">
        {loading && <CallHistorySkeleton />}
        {error && <p className="text-sm text-red-400 text-center py-10">{error}</p>}

        {!loading && !error && logs.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400">
            No calls yet. Start making calls!
          </div>
        )}

        {!loading && !error && logs.length > 0 && visibleLogs.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400">
            No {activeFilterLabel.toLowerCase()} calls found
            {debouncedSearchQuery ? ` matching "${debouncedSearchQuery}"` : ''}
            {selectedDate ? ' for this date' : ''}.
          </div>
        )}

        {!loading && !error && visibleLogs.map((log) => {
          const logId = log._id || log.callSid;
          const isSelected = selectedCallId === logId;
          const rawPhone = String(log.phoneNumber || '');
          const norm = normalizePhone(rawPhone);
          const contact = contactMap.get(norm);
          const hasSavedContact = Boolean(contact);
          const title = hasSavedContact ? contact.name : formatPhoneNumber(rawPhone);
          const subtitleNumber = hasSavedContact ? formatPhoneNumber(rawPhone) : '';

          const status = (log.status || '').toLowerCase();
          const callType = (log.callType || 'inbound').toLowerCase();
          const isMissed = status === 'missed' || status === 'rejected' || status === 'failed';
          const callDate = getCallDate(log);
          const timeFormatted = formatRelativeTime(callDate);
          const durationStr = isMissed ? 'Missed' : formatDuration(log.duration);
          const handledByName = log.handledByName || log.answeredByName;

          return (
            <div
              key={logId}
              onClick={() => handleRowClick(log)}
              className={`group call-log-tile rounded-xl p-2.5 sm:px-3 sm:py-2.5 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                isSelected
                  ? 'call-log-tile-selected bg-emerald-500/15 ring-1 ring-emerald-500/30'
                  : 'bg-transparent hover:bg-gray-800/40'
              }`}
            >
              {/* Left Icon + Call Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {getCallIcon(log)}

                <div className="min-w-0 flex-1">
                  {/* Line 1: Title (Contact Name or Phone Number) */}
                  <div className="flex items-center gap-2">
                    <p className={`call-title text-sm font-semibold truncate ${
                      isMissed ? 'call-title-missed text-red-400' : 'call-title-normal text-white'
                    }`}>
                      {title}
                    </p>
                    {contact?.company && (
                      <span className="hidden sm:inline-block text-[11px] text-gray-400 truncate">
                        • {contact.company}
                      </span>
                    )}
                  </div>

                  {/* Line 2: Details */}
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                    <span className="capitalize text-gray-300">
                      {status === 'answered-by-teammate'
                        ? 'Teammate'
                        : isMissed
                          ? 'Missed'
                          : callType}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span>{durationStr}</span>
                    {subtitleNumber && (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-gray-600">•</span>
                        <span className="font-mono text-[11px] text-gray-400 truncate">{subtitleNumber}</span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyNumber(e, rawPhone, logId)}
                          className="p-0.5 rounded text-gray-500 hover:text-emerald-400 transition"
                          title="Copy phone number"
                        >
                          {copiedId === logId ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </span>
                    )}
                    {handledByName && (
                      <>
                        <span className="text-gray-600">•</span>
                        <span className="call-handled-by text-emerald-400/90 truncate">{handledByName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side: Timestamp & Action Icons */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => handleCall(e, rawPhone)}
                    className="call-log-action call-log-action-call flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition"
                    title={`Call ${title}`}
                    aria-label={`Call ${title}`}
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <span className="call-log-action-separator" aria-hidden="true">|</span>
                  <button
                    type="button"
                    onClick={(e) => handleMessage(e, rawPhone)}
                    className="call-log-action call-log-action-message flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition"
                    title={`Message ${title}`}
                    aria-label={`Message ${title}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <span className="call-log-action-separator" aria-hidden="true">|</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCall(log);
                      setShowMobileDetails(true);
                    }}
                    className="call-log-action call-log-action-followup flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition"
                    title={`Open ${title} to add a follow-up`}
                    aria-label={`Open ${title} to add a follow-up`}
                  >
                    <BookmarkPlus className="w-4 h-4" />
                  </button>
                  <span className="call-log-action-separator" aria-hidden="true">|</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopyNumber(e, rawPhone, logId)}
                    className="call-log-action call-log-action-copy flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition"
                    title="Copy phone number"
                    aria-label="Copy phone number"
                  >
                    {copiedId === logId ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  {timeFormatted}
                </span>
              </div>
            </div>
          );
        })}

        {!loading && !error && hasMore && (
          <div className="px-4 py-4 text-center">
            <button
              type="button"
              onClick={loadMoreLogs}
              disabled={loadingMore}
              className="rounded-xl border border-gray-700 bg-[#0F141F] px-4 py-2 text-xs font-semibold text-gray-200 transition hover:border-gray-600 hover:bg-[#1F2533] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore ? 'Loading...' : 'Load more calls'}
            </button>
          </div>
        )}
      </div>

      {/* Mobile Drawer Overlay for CallDetails (< lg screens) */}
      {showMobileDetails && selectedCall && (
        <div className="fixed inset-0 z-50 bg-[#0F1322] lg:hidden flex flex-col animate-in fade-in slide-in-from-bottom duration-200">
          <CallDetails
            call={selectedCall}
            contacts={contacts}
            allLogs={logs}
            onSelectCall={(c) => onSelectCall(c)}
            onClose={() => setShowMobileDetails(false)}
          />
        </div>
      )}
    </div>
  );
}
