import { useCallback, useEffect, useState } from 'react';

const BACKEND_URL = 'https://business-voip.onrender.com';

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

  return (
    <div className="max-w-3xl mx-auto">
      <form onSubmit={sendMessage} className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
        <div className="mb-3">
          <label className="mb-1.5 block text-xs text-gray-400">To</label>
          <input
            type="tel"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="+1..."
            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-blue-500"
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
            className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-blue-500"
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
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {sending ? 'Sending...' : 'Send SMS'}
        </button>
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        <div className="border-b border-gray-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Recent Messages</h3>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No messages yet.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {messages.map((message) => (
              <div key={message._id || message.messageSid} className="px-4 py-3 hover:bg-[#1F2533]">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {message.direction === 'outbound' ? message.to : message.from}
                    </p>
                    <p className="text-xs capitalize text-gray-400">
                      {message.direction} | {message.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {formatDateTime(message.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-300">{message.body}</p>
                {message.userName && (
                  <p className="mt-1 text-right text-xs font-medium text-sky-300">{message.userName}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Messages;
