import { useState, useEffect, useMemo } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  MessageSquare,
  BookmarkPlus,
  Copy,
  Check,
  Calendar,
  Clock,
  User,
  FileText,
  X,
  ChevronRight,
  Info,
  Building,
  Mail,
  ShieldCheck,
  PhoneForwarded
} from 'lucide-react';
import { BACKEND_URL } from '../config/api.js';
import { showCopiedNumberToast, showErrorToast, showSuccessToast } from '../utils/toast.js';

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

const formatFullDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

const formatTimeOnly = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};

const getCallDate = (log) => log?.startedAt || log?.createdAt;

const isSameCalendarDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export default function CallDetails({ call, contacts = [], allLogs = [], onSelectCall, onClose }) {
  const [copied, setCopied] = useState(false);
  const [fetchedNumberLogs, setFetchedNumberLogs] = useState([]);
  const [followUpModal, setFollowUpModal] = useState(false);
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  // Fetch all call logs for this phone number to guarantee complete same-day history
  useEffect(() => {
    if (!call?.phoneNumber) return;
    let isCurrent = true;

    const fetchLogsForNumber = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch(`${BACKEND_URL}/api/calls/logs?phoneNumber=${encodeURIComponent(call.phoneNumber)}&limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        if (isCurrent) {
          setFetchedNumberLogs(items);
        }
      } catch (err) {
        console.error('Failed to fetch number call history:', err);
      }
    };

    fetchLogsForNumber();
    return () => { isCurrent = false; };
  }, [call?.phoneNumber]);

  // Match contact
  const matchedContact = useMemo(() => {
    if (!call?.phoneNumber) return null;
    const targetNorm = normalizePhone(call.phoneNumber);
    return (contacts || []).find((c) => normalizePhone(c.phone) === targetNorm) || null;
  }, [call?.phoneNumber, contacts]);

  // Gather same-day calls for this phone number
  const sameDayCalls = useMemo(() => {
    if (!call?.phoneNumber) return [];
    const currentDate = getCallDate(call);
    const targetNorm = normalizePhone(call.phoneNumber);

    const merged = new Map();

    const addIfSameDay = (item) => {
      if (!item || !item.phoneNumber) return;
      if (normalizePhone(item.phoneNumber) !== targetNorm) return;
      if (!isSameCalendarDay(getCallDate(item), currentDate)) return;
      const key = item._id || item.callSid;
      if (key && !merged.has(key)) {
        merged.set(key, item);
      }
    };

    if (call) addIfSameDay(call);
    (allLogs || []).forEach(addIfSameDay);
    (fetchedNumberLogs || []).forEach(addIfSameDay);

    return Array.from(merged.values()).sort((a, b) => {
      return new Date(getCallDate(b)).getTime() - new Date(getCallDate(a)).getTime();
    });
  }, [call, allLogs, fetchedNumberLogs]);

  if (!call) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-8 text-center bg-[#0F1322] text-gray-400">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 ring-1 ring-emerald-500/20">
          <PhoneCall className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">Call Details</h3>
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
          Select a call from the list to view its complete timeline, details, participant info, and transcript.
        </p>
      </div>
    );
  }

  const callId = call._id || call.callSid;
  const phoneNumber = call.phoneNumber || '';
  const displayName = matchedContact?.name || formatPhoneNumber(phoneNumber);
  const contactCompany = matchedContact?.company || '';
  const contactEmail = matchedContact?.email || '';

  const status = (call.status || '').toLowerCase();
  const callType = (call.callType || 'inbound').toLowerCase();
  const isMissed = status === 'missed' || status === 'rejected' || status === 'failed';
  const isTeammate = status === 'answered-by-teammate' || Boolean(call.handledByName);
  const handledByName = call.handledByName || call.answeredByName || (call.user?.name) || '';

  const transcriptText = String(call.transcriptionText || '').trim();
  const transcriptSegments = [...(call.transcriptionSegments || [])]
    .filter((s) => String(s.text || '').trim())
    .sort((a, b) => (a.sequenceId || 0) - (b.sequenceId || 0));

  const handleCopy = async () => {
    if (!phoneNumber) return;
    try {
      await navigator.clipboard.writeText(phoneNumber);
      setCopied(true);
      showCopiedNumberToast({ phoneNumber: formatPhoneNumber(phoneNumber) });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showErrorToast('Failed to copy number');
    }
  };

  const handleCall = () => {
    window.dispatchEvent(new CustomEvent('callContact', {
      detail: { phoneNumber }
    }));
  };

  const handleMessage = () => {
    window.dispatchEvent(new CustomEvent('openConversation', {
      detail: { phoneNumber }
    }));
  };

  const openFollowUpModal = () => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    defaultDate.setMinutes(defaultDate.getMinutes() - defaultDate.getTimezoneOffset());
    setFollowUpDate(defaultDate.toISOString().slice(0, 16));
    setFollowUpNote(`Follow up regarding call on ${formatFullDateTime(getCallDate(call))}`);
    setFollowUpModal(true);
  };

  const handleSaveFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpDate) {
      showErrorToast('Please choose a follow-up date');
      return;
    }

    try {
      setSavingFollowUp(true);
      const res = await fetch(`${BACKEND_URL}/api/followups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: displayName,
          phone: phoneNumber,
          note: followUpNote.trim(),
          followUpDate: new Date(followUpDate).toISOString()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save follow-up');

      showSuccessToast('Follow-up scheduled');
      window.dispatchEvent(new Event('refreshFollowUps'));
      setFollowUpModal(false);
    } catch (err) {
      showErrorToast(err.message || 'Failed to save follow-up');
    } finally {
      setSavingFollowUp(false);
    }
  };

  const getCallDirectionIcon = (type, stat) => {
    if (stat === 'missed' || stat === 'rejected' || stat === 'failed') {
      return <PhoneMissed className="w-4 h-4 text-red-400" />;
    }
    if (stat === 'answered-by-teammate') {
      return <PhoneForwarded className="w-4 h-4 text-emerald-400" />;
    }
    if (type === 'outbound') {
      return <PhoneOutgoing className="w-4 h-4 text-emerald-400" />;
    }
    return <PhoneIncoming className="w-4 h-4 text-sky-400" />;
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0F1322] text-white overflow-hidden">
      {/* Top Header */}
      <div className="h-12 md:h-14 shrink-0 border-b border-gray-800 bg-[#161B28] px-4 md:px-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold md:text-base">Call Information</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
            title="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-4">
        {/* Profile Card (WhatsApp style contact header) */}
        <div className="rounded-2xl border border-gray-800 bg-[#161B28] p-4 text-center shadow-lg">
          <div className="call-details-avatar mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-emerald-600/30 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-xl shadow-inner mb-3">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-base md:text-lg font-bold text-white truncate">
            {displayName}
          </h3>
          {matchedContact && (
            <p className="text-xs font-mono text-gray-400 mt-0.5">
              {formatPhoneNumber(phoneNumber)}
            </p>
          )}
          {(contactCompany || contactEmail) && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-400">
              {contactCompany && (
                <span className="inline-flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-gray-500" />
                  {contactCompany}
                </span>
              )}
              {contactEmail && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-gray-500" />
                  {contactEmail}
                </span>
              )}
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="mt-4 grid grid-cols-4 gap-2 pt-3 border-t border-gray-800/80">
            <button
              type="button"
              onClick={handleCall}
              className="call-details-action-call flex flex-col items-center justify-center gap-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 py-2 transition"
              title="Call now"
            >
              <Phone className="w-4 h-4" />
              <span className="text-[10px] font-semibold">Call</span>
            </button>
            <button
              type="button"
              onClick={handleMessage}
              className="call-details-action-btn flex flex-col items-center justify-center gap-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 transition"
              title="Send message"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-[10px] font-semibold">SMS</span>
            </button>
            <button
              type="button"
              onClick={openFollowUpModal}
              className="call-details-action-btn flex flex-col items-center justify-center gap-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 transition"
              title="Add follow-up"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span className="text-[10px] font-semibold">Follow Up</span>
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="call-details-action-btn flex flex-col items-center justify-center gap-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 transition"
              title="Copy number"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="text-[10px] font-semibold">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Selected Call Metadata Card */}
        <div className="rounded-2xl border border-gray-800 bg-[#161B28] p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Selected Call</span>
            <div className="call-details-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-200">
              {getCallDirectionIcon(callType, status)}
              <span className="capitalize">{status.replace(/-/g, ' ')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Direction</span>
              <span className="font-medium text-white capitalize">{callType}</span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Duration</span>
              <span className="font-medium text-white">{formatDuration(call.duration)}</span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Phone Number</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-medium text-white">{formatPhoneNumber(phoneNumber)}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded text-gray-400 hover:text-emerald-400 hover:bg-gray-800 transition"
                  title="Copy phone number"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {call.localNumber && (
              <div>
                <span className="text-gray-400 block mb-0.5">Assigned Number</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-medium text-gray-300">{formatPhoneNumber(call.localNumber)}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(call.localNumber);
                      showCopiedNumberToast({ phoneNumber: formatPhoneNumber(call.localNumber) });
                    }}
                    className="p-1 rounded text-gray-400 hover:text-emerald-400 hover:bg-gray-800 transition"
                    title="Copy assigned number"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            <div className="col-span-2">
              <span className="text-gray-400 block mb-0.5">Date & Exact Time</span>
              <span className="font-medium text-white">{formatFullDateTime(getCallDate(call))}</span>
            </div>
            {handledByName && (
              <div className="col-span-2">
                <span className="text-gray-400 block mb-0.5">Handled By</span>
                <span className="font-medium text-emerald-300">{handledByName}</span>
              </div>
            )}
            {Array.isArray(call.alsoNotifiedUsers) && call.alsoNotifiedUsers.length > 0 && (
              <div className="col-span-2">
                <span className="text-gray-400 block mb-0.5">Also Rung</span>
                <span className="text-gray-300">{call.alsoNotifiedUsers.join(', ')}</span>
              </div>
            )}
            {Array.isArray(call.missedByUsers) && call.missedByUsers.length > 1 && (
              <div className="col-span-2">
                <span className="text-gray-400 block mb-0.5">Missed By</span>
                <span className="text-gray-400">{call.missedByUsers.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Multiple Calls on the Same Day Section */}
        {sameDayCalls.length > 1 && (
          <div className="rounded-2xl border border-gray-800 bg-[#161B28] p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                  Calls on this day ({sameDayCalls.length})
                </h4>
              </div>
              <span className="text-[11px] text-gray-400">
                {new Date(getCallDate(call)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div className="space-y-2">
              {sameDayCalls.map((dayCall) => {
                const dayCallId = dayCall._id || dayCall.callSid;
                const isSelected = dayCallId === callId;
                const dayCallDate = getCallDate(dayCall);
                const dayCallStatus = (dayCall.status || '').toLowerCase();
                const dayCallType = (dayCall.callType || 'inbound').toLowerCase();
                const hasTranscript = Boolean(dayCall.transcriptionText || (dayCall.transcriptionSegments?.length > 0));

                return (
                  <div
                    key={dayCallId}
                    onClick={() => onSelectCall?.(dayCall)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition text-xs border ${
                      isSelected
                        ? 'call-day-item-selected bg-emerald-950/30 border-emerald-500/40 text-white'
                        : 'call-day-item bg-[#0F141F] border-gray-800/80 hover:bg-[#1A2232] text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-gray-800">
                        {getCallDirectionIcon(dayCallType, dayCallStatus)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white capitalize">
                            {dayCallType}
                          </span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400 capitalize">
                            {dayCallStatus.replace(/-/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                          <span>{formatTimeOnly(dayCallDate)}</span>
                          <span>•</span>
                          <span>{formatDuration(dayCall.duration)}</span>
                          {hasTranscript && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-400">
                              <FileText className="w-3 h-3" />
                              Transcript
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {isSelected ? (
                        <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          Viewing
                        </span>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transcription Card */}
        <div className="rounded-2xl border border-gray-800 bg-[#161B28] p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                Transcription
              </h4>
            </div>
            {transcriptText && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Available
              </span>
            )}
          </div>

          <div className="h-64 overflow-y-auto thin-scrollbar pr-2">
            {transcriptSegments.length > 0 ? (
              <div className="space-y-2">
                {transcriptSegments.map((segment, idx) => {
                  const track = String(segment.track || '').toLowerCase();
                  const isAgent = track.includes('agent') || track.includes('user') || (callType === 'outbound' && track.includes('inbound'));

                  return (
                    <p
                      key={`${segment.sequenceId || idx}`}
                      className="transcript-line text-sm leading-6 whitespace-pre-wrap"
                    >
                      <span className={`font-semibold ${isAgent ? 'text-emerald-400' : 'text-sky-400'}`}>
                        {isAgent ? 'Agent:' : 'Client:'}
                      </span>{' '}
                      <span>{segment.text}</span>
                    </p>
                  );
                })}
              </div>
            ) : transcriptText ? (
              <p className="transcript-line text-sm leading-6 whitespace-pre-wrap">{transcriptText}</p>
            ) : (
              <div className="py-6 text-center text-xs text-gray-500">
                {call.transcriptionStatus === 'in-progress' || call.transcriptionStatus === 'processing' ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Transcription is currently processing...
                  </div>
                ) : (
                  'No transcription recorded for this call.'
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Follow Up Modal */}
      {followUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <form
            onSubmit={handleSaveFollowUp}
            className="w-full max-w-sm rounded-2xl border border-gray-800 bg-[#161B28] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Add Follow-Up</h3>
              <button
                type="button"
                onClick={() => setFollowUpModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Contact</label>
              <input
                type="text"
                disabled
                value={displayName}
                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                required
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-[#0F141F] px-3 py-2 text-xs text-white focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Note</label>
              <textarea
                rows={3}
                required
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="What to follow up about..."
                className="w-full rounded-xl border border-gray-700 bg-[#0F141F] px-3 py-2 text-xs text-white focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setFollowUpModal(false)}
                className="px-3 py-2 rounded-xl text-xs font-medium text-gray-400 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingFollowUp}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                {savingFollowUp ? 'Saving...' : 'Save Follow-Up'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
