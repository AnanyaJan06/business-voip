import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';

const BACKEND_URL = 'https://business-voip.onrender.com';

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

const messageStatusStyles = {
  delivered: 'text-emerald-300',
  sent: 'text-sky-300',
  queued: 'text-amber-300',
  sending: 'text-amber-300',
  accepted: 'text-amber-300',
  undelivered: 'text-red-300',
  failed: 'text-red-300'
};

const formatMessageStatus = (status = '') => (
  status ? status.replace('-', ' ') : 'queued'
);

function ConversationDetails({ phoneNumber, onClose }) {
  const [calls, setCalls] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const timelineEndRef = useRef(null);

  const selectedDigits = normalizePhone(phoneNumber);

  const fetchConversation = useCallback(async () => {
    if (!phoneNumber) return;

    try {
      setLoading(true);
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      };

      const [callsRes, messagesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/calls/logs`, { headers }),
        fetch(`${BACKEND_URL}/api/messages`, { headers })
      ]);

      const [callsData, messagesData] = await Promise.all([
        callsRes.json(),
        messagesRes.json()
      ]);

      if (!callsRes.ok) throw new Error(callsData.message || 'Failed to load calls');
      if (!messagesRes.ok) throw new Error(messagesData.message || 'Failed to load messages');

      setCalls(callsData);
      setMessages(messagesData);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }, [phoneNumber]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  useEffect(() => {
    const refresh = () => fetchConversation();
    window.addEventListener('refreshCallHistory', refresh);
    window.addEventListener('refreshMessages', refresh);
    return () => {
      window.removeEventListener('refreshCallHistory', refresh);
      window.removeEventListener('refreshMessages', refresh);
    };
  }, [fetchConversation]);

  const timeline = useMemo(() => {
    if (!selectedDigits) return [];

    const matchingCalls = calls
      .filter((call) => normalizePhone(call.phoneNumber) === selectedDigits)
      .map((call) => ({
        id: call._id || call.callSid,
        type: 'call',
        direction: call.callType || 'call',
        status: call.status || 'completed',
        duration: Number(call.duration) || 0,
        date: call.startedAt || call.createdAt,
        userName: call.userName || call.user?.name || ''
      }));

    const matchingMessages = messages
      .filter((message) => {
        const values = [message.phoneNumber, message.from, message.to].map(normalizePhone);
        return values.includes(selectedDigits);
      })
      .map((message) => ({
        id: message._id || message.messageSid,
        type: 'sms',
        direction: message.direction,
        status: message.status,
        errorCode: message.errorCode,
        deliveredAt: message.deliveredAt,
        body: message.body,
        date: message.createdAt,
        userName: message.userName || message.user?.name || ''
      }));

    return [...matchingCalls, ...matchingMessages]
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [calls, messages, selectedDigits]);

  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const formatTime = (date) => new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const formatDuration = (seconds) => {
    const value = Number(seconds) || 0;
    const minutes = Math.floor(value / 60);
    const secs = value % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  const groupedTimeline = timeline.reduce((groups, item) => {
    const key = formatDate(item.date);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});

  useEffect(() => {
    if (!loading && phoneNumber) {
      timelineEndRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [loading, phoneNumber, timeline.length]);

  const handleCall = () => {
    window.dispatchEvent(new CustomEvent('callContact', {
      detail: { phoneNumber }
    }));
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const trimmedBody = messageBody.trim();
    if (!trimmedBody) return;

    try {
      setSending(true);
      setNotice('');

      const res = await fetch(`${BACKEND_URL}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          to: phoneNumber,
          body: trimmedBody
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send message');

      setMessageBody('');
      fetchConversation();
      window.dispatchEvent(new Event('refreshMessages'));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSending(false);
    }
  };

  if (!phoneNumber) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-gray-500">
        Select a phone number from calls or messages to view the full conversation.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0F1322]">
      <div className="border-b border-gray-800 bg-[#161B28] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(phoneNumber)}
              className="truncate text-left text-xl font-semibold text-white hover:text-emerald-300"
              title="Copy number"
            >
              {phoneNumber}
            </button>
            <p className="mt-1 text-xs text-gray-400">
              {timeline.length} interaction{timeline.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCall}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-500"
              title="Call"
              aria-label="Call"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.61a2 2 0 0 1-.45 2.11L8 9.72" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-700 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-gray-800 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-auto px-5 py-4">
        {loading && <LoadingSpinner label="Loading conversation..." tone="emerald" />}

        {!loading && timeline.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No calls or messages found for this number.</p>
        )}

        {!loading && Object.entries(groupedTimeline).map(([date, items]) => (
          <div key={date}>
            <div className="mb-4 mt-2 flex justify-center">
              <span className="rounded-full border border-gray-700 bg-[#161B28] px-3 py-1 text-xs text-gray-300">
                {date}
              </span>
            </div>

            <div className="space-y-3">
              {items.map((item) => {
                const isOutbound = item.direction === 'outbound';
                const isCall = item.type === 'call';

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[74%] rounded-2xl px-4 py-3 shadow-lg ${
                      isCall
                        ? 'conversation-call-bubble bg-[#1C2333] text-white'
                        : isOutbound
                          ? 'conversation-sms-outbound bg-[#1E293B] text-white'
                          : 'conversation-sms-inbound bg-[#4B5563] text-white'
                    }`}>
                      {isCall ? (
                        <>
                          <p className={`text-sm font-semibold capitalize ${
                            item.status === 'missed' || item.status === 'failed' || item.status === 'rejected'
                              ? 'text-red-300'
                              : 'text-emerald-300'
                          }`}>
                            {item.status} {item.direction} call
                          </p>
                          <p className="mt-1 text-xs text-gray-300">
                            Duration {formatDuration(item.duration)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap text-sm leading-6">{item.body}</p>
                          <p className="mt-2 text-xs uppercase tracking-wide text-gray-300">
                            SMS
                            {isOutbound && (
                              <span className={`ml-2 capitalize ${
                                messageStatusStyles[item.status] || messageStatusStyles.queued
                              }`}>
                                {formatMessageStatus(item.status)}
                              </span>
                            )}
                          </p>
                          {item.errorCode && (
                            <p className="mt-1 text-xs text-red-300">Error {item.errorCode}</p>
                          )}
                        </>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-4 text-xs text-gray-400">
                        <span>{item.userName}</span>
                        <span>{formatTime(item.date)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={timelineEndRef} />
      </div>

      <form onSubmit={sendMessage} className="border-t border-gray-800 bg-[#161B28] p-4">
        {notice && <p className="mb-2 rounded-lg bg-red-600 px-3 py-2 text-xs text-white">{notice}</p>}
        <textarea
          value={messageBody}
          onChange={(event) => setMessageBody(event.target.value)}
          rows={3}
          maxLength={1600}
          placeholder="Write a message..."
          className="w-full resize-none rounded-2xl border border-gray-700 bg-[#0F1322] px-4 py-3 text-sm text-white focus:border-[#059669]"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">{messageBody.length}/1600</span>
          <button
            type="submit"
            disabled={sending || !messageBody.trim()}
            className="rounded-xl bg-[#059669] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:bg-gray-700 disabled:text-gray-400"
          >
            {sending ? <LoadingSpinner label="Sending..." size="sm" tone="white" inline /> : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ConversationDetails;
