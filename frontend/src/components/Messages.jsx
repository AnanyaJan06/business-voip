import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';

const BACKEND_URL = 'https://business-voip.onrender.com';

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

function Messages({ selectedPhoneNumber = '', onRecipientUsed }) {
  const [messages, setMessages] = useState([]);
  const [recipient, setRecipient] = useState(selectedPhoneNumber);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState({ text: '', type: '' });

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/messages`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load messages');
      }

      setMessages(data);
    } catch (error) {
      setNotice({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const handleIncomingMessage = () => fetchMessages();
    window.addEventListener('refreshMessages', handleIncomingMessage);
    return () => window.removeEventListener('refreshMessages', handleIncomingMessage);
  }, [fetchMessages]);

  useEffect(() => {
    if (selectedPhoneNumber) {
      setRecipient(selectedPhoneNumber);
      onRecipientUsed?.();
    }
  }, [selectedPhoneNumber, onRecipientUsed]);

  const sendMessage = async (event) => {
    event.preventDefault();

    if (!recipient.trim() || !body.trim()) {
      setNotice({ text: 'Add a recipient and message before sending.', type: 'error' });
      return;
    }

    try {
      setSending(true);
      setNotice({ text: '', type: '' });

      const res = await fetch(`${BACKEND_URL}/api/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          to: recipient.trim(),
          body: body.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.code === 30034
          ? 'A2P 10DLC is not approved yet for this sender.'
          : data.message || 'Failed to send message');
      }

      setBody('');
      setNotice({ text: 'Message queued successfully.', type: 'success' });
      fetchMessages();
    } catch (error) {
      setNotice({ text: error.message, type: 'error' });
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

  const openConversation = (phoneNumber) => {
    window.dispatchEvent(new CustomEvent('openConversation', {
      detail: { phoneNumber }
    }));
  };

  const getThreadNumber = (message) => (
    message.direction === 'outbound' ? message.to : message.from
  );

  const messageThreads = useMemo(() => {
    const threads = new Map();

    messages.forEach((message) => {
      const phoneNumber = getThreadNumber(message);
      const key = normalizePhone(phoneNumber) || phoneNumber;
      const existing = threads.get(key);

      if (!existing || new Date(message.createdAt) > new Date(existing.createdAt)) {
        threads.set(key, {
          ...message,
          phoneNumber
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

  return (
    <div className="max-w-3xl mx-auto">
      {!loading && (
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
      )}

      <form onSubmit={sendMessage} className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
        <div className="mb-3">
          <label className="mb-1.5 block text-xs text-gray-400">To</label>
          <input
            type="tel"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="+1..."
            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-xs text-gray-400">Message</label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            maxLength={1600}
            placeholder="Write a message..."
            className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
          />
          <div className="mt-1 text-right text-[11px] text-gray-500">{body.length}/1600</div>
        </div>

        {notice.text && (
          <div className={`mb-3 rounded-xl px-3 py-2 text-xs text-white ${
            notice.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}>
            {notice.text}
          </div>
        )}

        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-xl bg-[#059669] py-3 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:opacity-60"
        >
          {sending ? <LoadingSpinner label="Sending..." size="sm" tone="white" inline /> : 'Send SMS'}
        </button>
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        <div className="border-b border-gray-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Recent Messages</h3>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading messages..." />
        ) : messageThreads.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No messages yet.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {messageThreads.map((message) => (
              <div key={message._id || message.messageSid} className="px-4 py-3 hover:bg-[#1F2533]">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => openConversation(message.phoneNumber)}
                      className="block max-w-full truncate text-left text-sm font-semibold text-white transition hover:text-emerald-300"
                      title="Open conversation"
                    >
                      {message.phoneNumber}
                    </button>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {formatDateTime(message.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Messages;
