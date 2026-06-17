import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppSkeletonTheme, Skeleton } from './ui/AppSkeleton.jsx';
import InlineLoader from './ui/InlineLoader.jsx';
import { showErrorToast, showSuccessToast } from '../utils/toast.js';

const BACKEND_URL = 'https://business-voip.onrender.com';

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

const getUserId = (user) => String(user?.id || user?._id || '');
const getUnreadSmsThreadsKey = (userId) => `unreadSmsThreads:${userId || 'unknown'}`;

const messageStatusStyles = {
  delivered: 'bg-emerald-500/15 text-emerald-300',
  sent: 'bg-sky-500/15 text-sky-300',
  queued: 'bg-amber-500/15 text-amber-300',
  sending: 'bg-amber-500/15 text-amber-300',
  accepted: 'bg-amber-500/15 text-amber-300',
  undelivered: 'bg-red-500/15 text-red-300',
  failed: 'bg-red-500/15 text-red-300'
};

const formatMessageStatus = (status = '') => (
  status ? status.replace('-', ' ') : 'queued'
);

function MessagesSkeleton() {
  return (
    <AppSkeletonTheme>
      <div role="status" aria-label="Loading messages">
        <div className="mb-4 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-3">
              <Skeleton width={54} height={10} className="mx-auto block" />
              <Skeleton width={28} height={20} className="mx-auto mt-2 block" />
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 px-4 py-3">
            <Skeleton width={126} height={16} />
          </div>
          <div className="divide-y divide-gray-800">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Skeleton width={132} height={16} />
                    <Skeleton width="84%" height={12} className="mt-2 block" />
                    <Skeleton width={86} height={18} className="mt-2 block" borderRadius={999} />
                  </div>
                  <Skeleton width={58} height={12} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppSkeletonTheme>
  );
}

function Messages({ selectedPhoneNumber = '', onRecipientUsed, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [recipient, setRecipient] = useState(selectedPhoneNumber);
  const [body, setBody] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(Boolean(selectedPhoneNumber));
  const [unreadThreadKeys, setUnreadThreadKeys] = useState([]);

  const unreadStorageKey = getUnreadSmsThreadsKey(getUserId(currentUser));

  const readUnreadThreadKeys = useCallback(() => {
    try {
      const value = JSON.parse(localStorage.getItem(unreadStorageKey) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }, [unreadStorageKey]);

  const writeUnreadThreadKeys = useCallback((keys) => {
    const uniqueKeys = [...new Set(keys.filter(Boolean))];
    localStorage.setItem(unreadStorageKey, JSON.stringify(uniqueKeys));
    setUnreadThreadKeys(uniqueKeys);
  }, [unreadStorageKey]);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/messages`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to load messages');
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      showErrorToast(error.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnreadThreadKeys(readUnreadThreadKeys());
  }, [readUnreadThreadKeys]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const handleIncomingMessage = (event) => {
      const incomingMessage = event.detail?.message;
      if (incomingMessage?.direction !== 'outbound') {
        const phoneNumber = incomingMessage?.from || incomingMessage?.phoneNumber;
        const threadKey = normalizePhone(phoneNumber) || phoneNumber;
        writeUnreadThreadKeys([...readUnreadThreadKeys(), threadKey]);
      }

      fetchMessages();
    };

    window.addEventListener('refreshMessages', handleIncomingMessage);
    return () => window.removeEventListener('refreshMessages', handleIncomingMessage);
  }, [fetchMessages, readUnreadThreadKeys, writeUnreadThreadKeys]);

  useEffect(() => {
    if (selectedPhoneNumber) {
      setRecipient(selectedPhoneNumber);
      setShowCompose(true);
      onRecipientUsed?.();
    }
  }, [selectedPhoneNumber, onRecipientUsed]);

  const sendMessage = async (event) => {
    event.preventDefault();

    if (!recipient.trim() || (!body.trim() && !imageFile)) {
      showErrorToast('Add a recipient and message or image before sending.');
      return;
    }

    try {
      setSending(true);
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

        if (!uploadRes.ok) throw new Error(uploadData.message || 'Failed to upload image');
        mediaUrls = [uploadData.mediaUrl];
      }

      const res = await fetch(`${BACKEND_URL}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          to: recipient.trim(),
          body: body.trim(),
          mediaUrls
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.code === 30034
          ? 'A2P 10DLC is not approved yet for this sender.'
          : data.message || 'Failed to send message');
      }

      setBody('');
      setImageFile(null);
      showSuccessToast(imageFile ? 'Image message queued successfully' : 'Message queued successfully');
      fetchMessages();
    } catch (error) {
      showErrorToast(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatDateTime = (date) => {
    const value = new Date(date);
    return `${value.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })} ${value.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  };

  const getThreadNumber = (message) => (
    message.direction === 'outbound' ? message.to : message.from
  );

  const getAllottedNumberLabel = (message) => {
    const allottedNumber = message.direction === 'outbound' ? message.from : message.to;
    if (!allottedNumber) return '';

    return message.direction === 'outbound'
      ? `From ${allottedNumber}`
      : `To ${allottedNumber}`;
  };

  const openConversation = (phoneNumber) => {
    const threadKey = normalizePhone(phoneNumber) || phoneNumber;
    writeUnreadThreadKeys(unreadThreadKeys.filter((key) => key !== threadKey));
    window.dispatchEvent(new CustomEvent('openConversation', {
      detail: { phoneNumber }
    }));
  };

  const messageThreads = useMemo(() => {
    const threads = new Map();

    messages.forEach((message) => {
      const phoneNumber = getThreadNumber(message);
      const key = normalizePhone(phoneNumber) || phoneNumber;
      const existing = threads.get(key);

      if (!existing || new Date(message.createdAt) > new Date(existing.createdAt)) {
        threads.set(key, {
          ...message,
          phoneNumber,
          threadKey: key
        });
      }
    });

    return [...threads.values()]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [messages]);

  const messageTotals = useMemo(() => messages.reduce((acc, message) => {
    const direction = message.direction?.toLowerCase();

    acc.total += 1;
    if (direction === 'inbound') acc.inbound += 1;
    if (direction === 'outbound') acc.outbound += 1;

    return acc;
  }, {
    total: 0,
    inbound: 0,
    outbound: 0
  }), [messages]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <MessagesSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Messages</h2>
          <p className="mt-0.5 text-xs text-gray-400">Recent SMS conversations</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCompose((current) => !current)}
          className="rounded-xl bg-[#059669] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#047857]"
        >
          {showCompose ? 'Close SMS' : 'Create SMS'}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          ['Total', messageTotals.total],
          ['Inbound', messageTotals.inbound],
          ['Outbound', messageTotals.outbound]
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {showCompose && (
        <form onSubmit={sendMessage} className="mb-4 rounded-2xl border border-gray-700 bg-gray-900 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label className="mb-1.5 block text-xs text-gray-400">To</label>
              <input
                type="tel"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="+1..."
                className="h-10 w-full rounded-xl border border-gray-700 bg-gray-800 px-3 text-sm text-white focus:border-[#059669]"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="self-end rounded-xl bg-[#059669] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:opacity-60"
            >
              {sending ? <InlineLoader label="Sending..." /> : 'Send SMS'}
            </button>
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs text-gray-400">Message</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={2}
              maxLength={1600}
              placeholder="Write a message..."
              className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-[#059669]"
            />
            <div className="mt-1 text-right text-[11px] text-gray-500">{body.length}/1600</div>
          </div>

          <div className="mt-3 rounded-xl border border-dashed border-gray-700 bg-gray-800/60 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-300">Image</p>
                <p className="mt-1 truncate text-[11px] text-gray-500">
                  {imageFile ? imageFile.name : 'Attach JPG, PNG, GIF, or WebP'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {imageFile && (
                  <button
                    type="button"
                    onClick={() => setImageFile(null)}
                    className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white"
                  >
                    Remove
                  </button>
                )}
                <label className="cursor-pointer rounded-lg bg-gray-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-600">
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
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Recent Messages</h3>
          {unreadThreadKeys.length > 0 && (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">
              {unreadThreadKeys.length} unread
            </span>
          )}
        </div>

        {messageThreads.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No messages yet.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {messageThreads.map((message) => {
              const isUnread = unreadThreadKeys.includes(message.threadKey);
              const lastMessage = String(message.body || '').trim()
                || (message.mediaUrls?.length ? 'Image message' : 'No message text');

              return (
                <button
                  key={message._id || message.messageSid}
                  type="button"
                  onClick={() => openConversation(message.phoneNumber)}
                  className="block w-full px-4 py-3 text-left transition hover:bg-[#1F2533]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        {isUnread && (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-label="Unread message" />
                        )}
                        <span className={`truncate text-sm font-semibold ${
                          isUnread ? 'text-white' : 'text-gray-200'
                        }`}>
                          {message.phoneNumber}
                        </span>
                      </div>

                      <p className={`mt-1 line-clamp-1 text-xs ${
                        isUnread ? 'font-semibold text-gray-200' : 'text-gray-400'
                      }`}>
                        {message.direction === 'outbound' ? 'You: ' : ''}
                        {lastMessage}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {message.direction === 'outbound' ? (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                            messageStatusStyles[message.status] || messageStatusStyles.queued
                          }`}>
                            {formatMessageStatus(message.status)}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-700 px-2 py-0.5 text-[11px] font-semibold text-gray-300">
                            Received
                          </span>
                        )}
                        {getAllottedNumberLabel(message) && (
                          <span className="truncate text-xs text-gray-500">
                            {getAllottedNumberLabel(message)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatDateTime(message.createdAt)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Messages;
