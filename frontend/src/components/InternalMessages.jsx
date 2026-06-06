import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BACKEND_URL } from '../config/api.js';
import LoadingSpinner from './LoadingSpinner.jsx';

const getUserId = (user) => user?._id || user?.id || '';

const formatTime = (date) => new Date(date).toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit'
});

function InternalMessages({ currentUser, onReadMessages }) {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState({ text: '', type: '' });
  const listRef = useRef(null);

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }), []);

  const selectedUser = useMemo(() => (
    users.find((user) => getUserId(user) === selectedUserId)
  ), [selectedUserId, users]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch(`${BACKEND_URL}/api/internal-messages/users`, {
        headers: authHeaders
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to load chat users');

      setUsers(Array.isArray(data) ? data : []);
      setSelectedUserId((current) => current || getUserId(data?.[0]) || '');
    } catch (error) {
      setNotice({ text: error.message, type: 'error' });
    } finally {
      setLoadingUsers(false);
    }
  }, [authHeaders]);

  const fetchConversation = useCallback(async (userId = selectedUserId) => {
    if (!userId) {
      setMessages([]);
      return;
    }

    try {
      setLoadingMessages(true);
      const res = await fetch(`${BACKEND_URL}/api/internal-messages/${userId}`, {
        headers: authHeaders
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to load conversation');

      setMessages(Array.isArray(data) ? data : []);
      onReadMessages?.();
    } catch (error) {
      setNotice({ text: error.message, type: 'error' });
    } finally {
      setLoadingMessages(false);
    }
  }, [authHeaders, onReadMessages, selectedUserId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchConversation(selectedUserId);
  }, [fetchConversation, selectedUserId]);

  useEffect(() => {
    const refresh = () => {
      fetchUsers();
      fetchConversation(selectedUserId);
    };

    window.addEventListener('refreshInternalMessages', refresh);
    return () => window.removeEventListener('refreshInternalMessages', refresh);
  }, [fetchConversation, fetchUsers, selectedUserId]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages]);

  const sendMessage = async (event) => {
    event.preventDefault();

    if (!selectedUserId || !body.trim()) {
      setNotice({ text: 'Choose a user and write a message.', type: 'error' });
      return;
    }

    try {
      setSending(true);
      setNotice({ text: '', type: '' });

      const res = await fetch(`${BACKEND_URL}/api/internal-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          recipientId: selectedUserId,
          body: body.trim()
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to send message');

      setBody('');
      setMessages((current) => [...current, data]);
    } catch (error) {
      setNotice({ text: error.message, type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 md:grid-cols-[180px_1fr]">
        <div className="border-b border-gray-800 md:border-b-0 md:border-r">
          <div className="border-b border-gray-800 px-3 py-3">
            <h3 className="text-sm font-semibold text-white">Team Chat</h3>
            <p className="text-xs text-gray-400">Admins and agents</p>
          </div>

          {loadingUsers ? (
            <LoadingSpinner label="Loading users..." />
          ) : users.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-400">No users available.</p>
          ) : (
            <div className="max-h-52 divide-y divide-gray-800 overflow-auto md:max-h-none">
              {users.map((user) => {
                const userId = getUserId(user);
                const active = userId === selectedUserId;

                return (
                  <button
                    key={userId}
                    type="button"
                    onClick={() => setSelectedUserId(userId)}
                    className={`block w-full px-3 py-3 text-left transition ${
                      active ? 'bg-emerald-500/10 text-white' : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <span className="block truncate text-sm font-semibold">{user.name}</span>
                    <span className="block truncate text-[11px] capitalize text-gray-500">{user.role}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="border-b border-gray-800 px-4 py-3">
            <p className="truncate text-sm font-semibold text-white">
              {selectedUser ? selectedUser.name : 'Select a conversation'}
            </p>
            <p className="truncate text-xs text-gray-400">{selectedUser?.email || 'Messages stay inside the app'}</p>
          </div>

          {notice.text && (
            <div className={`m-3 rounded-xl px-3 py-2 text-xs text-white ${
              notice.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}>
              {notice.text}
            </div>
          )}

          <div ref={listRef} className="min-h-[280px] flex-1 space-y-3 overflow-auto p-4 thin-scrollbar">
            {loadingMessages ? (
              <LoadingSpinner label="Loading conversation..." />
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">No team messages yet.</p>
            ) : (
              messages.map((message) => {
                const mine = getUserId(message.sender) === getUserId(currentUser);

                return (
                  <div key={message._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] rounded-xl px-3 py-2 ${
                      mine ? 'bg-[#059669] text-white' : 'bg-gray-800 text-gray-100'
                    }`}>
                      <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                      <p className={`mt-1 text-[10px] ${mine ? 'text-emerald-50/80' : 'text-gray-500'}`}>
                        {formatTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={sendMessage} className="border-t border-gray-800 p-3">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              maxLength={2000}
              disabled={!selectedUserId}
              placeholder={selectedUserId ? 'Write a team message...' : 'Select a user first'}
              className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669] disabled:opacity-60"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[11px] text-gray-500">{body.length}/2000</span>
              <button
                type="submit"
                disabled={sending || !selectedUserId}
                className="rounded-xl bg-[#059669] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:opacity-60"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default InternalMessages;
