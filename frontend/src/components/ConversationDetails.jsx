import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppSkeletonTheme, Skeleton } from './ui/AppSkeleton.jsx';
import InlineLoader from './ui/InlineLoader.jsx';

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

const upsertMessage = (messages, message) => {
  if (!message?._id && !message?.messageSid) return messages;

  const messageId = String(message._id || message.messageSid);
  const exists = messages.some((item) => String(item._id || item.messageSid) === messageId);

  return exists ? messages : [...messages, message];
};

const normalizeIncomingMessage = (message) => ({
  ...message,
  phoneNumber: message.phoneNumber || message.from,
  direction: message.direction || 'inbound',
  status: message.status || 'received'
});

function ConversationDetailsSkeleton() {
  return (
    <AppSkeletonTheme>
      <div role="status" aria-label="Loading conversation">
      <div className="mb-5 flex justify-center">
        <Skeleton width={96} height={24} borderRadius={999} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-start">
          <div className="w-[68%] rounded-2xl bg-[#1C2333] px-4 py-3 shadow-lg">
            <Skeleton width={118} height={16} />
            <Skeleton width="72%" height={12} className="mt-2 block" />
            <div className="mt-3 flex items-center justify-between gap-4">
              <Skeleton width={72} height={12} />
              <Skeleton width={48} height={12} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="w-[74%] rounded-2xl bg-[#1E293B] px-4 py-3 shadow-lg">
            <Skeleton width="88%" height={14} />
            <Skeleton width="64%" height={14} className="mt-2 block" />
            <div className="mt-3 flex items-center justify-between gap-4">
              <Skeleton width={48} height={12} />
              <Skeleton width={52} height={12} />
            </div>
          </div>
        </div>

        <div className="flex justify-start">
          <div className="w-[62%] rounded-2xl bg-[#1C2333] px-4 py-3 shadow-lg">
            <Skeleton width={104} height={16} />
            <Skeleton width="58%" height={12} className="mt-2 block" />
            <div className="mt-3 flex items-center justify-between gap-4">
              <Skeleton width={64} height={12} />
              <Skeleton width={44} height={12} />
            </div>
          </div>
        </div>
      </div>
      </div>
    </AppSkeletonTheme>
  );
}

function ConversationDetails({ phoneNumber, onClose }) {
  const [calls, setCalls] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageBody, setMessageBody] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const timelineEndRef = useRef(null);

  const selectedDigits = normalizePhone(phoneNumber);

  const fetchConversation = useCallback(async ({ silent = false } = {}) => {
    if (!phoneNumber) return;

    try {
      if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, [phoneNumber]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  useEffect(() => {
    const refreshCalls = () => fetchConversation({ silent: true });
    const refreshMessages = (event) => {
      const message = event.detail?.message;
      if (!message) {
        fetchConversation({ silent: true });
        return;
      }

      const values = [message.phoneNumber, message.from, message.to].map(normalizePhone);
      if (!values.includes(selectedDigits)) return;

      setMessages((current) => upsertMessage(current, normalizeIncomingMessage(message)));
    };

    window.addEventListener('refreshCallHistory', refreshCalls);
    window.addEventListener('refreshMessages', refreshMessages);
    return () => {
      window.removeEventListener('refreshCallHistory', refreshCalls);
      window.removeEventListener('refreshMessages', refreshMessages);
    };
  }, [fetchConversation, selectedDigits]);

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
        localNumber: call.localNumber || '',
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
        from: message.from,
        to: message.to,
        body: message.body,
        mediaUrls: message.mediaUrls || [],
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

  const getAllottedNumberLabel = (item) => {
    if (item.type === 'call') {
      if (!item.localNumber) return '';
      return item.direction === 'outbound'
        ? `From ${item.localNumber}`
        : `To ${item.localNumber}`;
    }

    const allottedNumber = item.direction === 'outbound' ? item.from : item.to;
    if (!allottedNumber) return '';

    return item.direction === 'outbound'
      ? `From ${allottedNumber}`
      : `To ${allottedNumber}`;
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
    if (!trimmedBody && !imageFile) return;

    try {
      setSending(true);
      setNotice('');

      let mediaUrls = [];

      if (imageFile) {
        const uploadRes = await fetch(`${BACKEND_URL}/api/messages/upload-image`, {
          method: 'POST',
          headers: {
            'Content-Type': imageFile.type,
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: imageFile
        });

        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadData.message || 'Failed to upload image');
        }

        mediaUrls = [uploadData.mediaUrl];
      }

      const res = await fetch(`${BACKEND_URL}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          to: phoneNumber,
          body: trimmedBody,
          mediaUrls
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send message');

      setMessageBody('');
      setImageFile(null);
      if (data.messageLog) {
        setMessages((current) => upsertMessage(current, data.messageLog));
        window.dispatchEvent(new CustomEvent('refreshMessages', {
          detail: { message: data.messageLog }
        }));
      } else {
        fetchConversation({ silent: true });
        window.dispatchEvent(new Event('refreshMessages'));
      }
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
        {loading && <ConversationDetailsSkeleton />}

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
                const allottedNumberLabel = getAllottedNumberLabel(item);

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
                          {allottedNumberLabel && (
                            <p className="mt-1 text-xs text-gray-400">{allottedNumberLabel}</p>
                          )}
                        </>
                      ) : (
                        <>
                          {item.mediaUrls?.length > 0 && (
                            <div className="mb-2 space-y-2">
                              {item.mediaUrls.map((mediaUrl) => (
                                <a key={mediaUrl} href={mediaUrl} target="_blank" rel="noreferrer">
                                  <img
                                    src={mediaUrl}
                                    alt="Message attachment"
                                    className="max-h-64 rounded-xl object-contain"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                          {item.body && <p className="whitespace-pre-wrap text-sm leading-6">{item.body}</p>}
                          <p className="mt-2 text-xs uppercase tracking-wide text-gray-300">
                            {item.mediaUrls?.length > 0 ? 'MMS' : 'SMS'}
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
                          {allottedNumberLabel && (
                            <p className="mt-1 text-xs text-gray-400">{allottedNumberLabel}</p>
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
        <div className="mt-2 rounded-xl border border-dashed border-gray-700 bg-[#0F1322] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-gray-400">
              {imageFile ? imageFile.name : 'Attach an image'}
            </span>
            <div className="flex items-center gap-2">
              {imageFile && (
                <button
                  type="button"
                  onClick={() => setImageFile(null)}
                  className="rounded-lg border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 transition hover:bg-gray-800 hover:text-white"
                >
                  Remove
                </button>
              )}
              <label className="cursor-pointer rounded-lg bg-gray-700 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-600">
                Choose Image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">{messageBody.length}/1600</span>
          <button
            type="submit"
            disabled={sending || (!messageBody.trim() && !imageFile)}
            className="rounded-xl bg-[#059669] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:bg-gray-700 disabled:text-gray-400"
          >
            {sending ? <InlineLoader label="Sending..." /> : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ConversationDetails;
