import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';

const BACKEND_URL = 'https://business-voip.onrender.com';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'agent'
};

function StatCard({ label, value, tone }) {
  const tones = {
    total: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    inbound: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    outbound: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    missed: 'border-red-500/20 bg-red-500/10 text-red-300',
    messages: 'border-violet-500/20 bg-violet-500/10 text-violet-300'
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function AdminDashboard({ showStats = true, showCreateUser = true, showUsers = true }) {
  const [calls, setCalls] = useState([]);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState({ text: '', type: '' });

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }), []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const requests = [
        fetch(`${BACKEND_URL}/api/calls/logs`, { headers: authHeaders }),
        fetch(`${BACKEND_URL}/api/messages`, { headers: authHeaders })
      ];

      if (showUsers) {
        requests.push(fetch(`${BACKEND_URL}/api/auth/users`, { headers: authHeaders }));
      }

      const [callsRes, messagesRes, usersRes] = await Promise.all(requests);

      const responses = [
        callsRes.json(),
        messagesRes.json()
      ];

      if (usersRes) {
        responses.push(usersRes.json());
      }

      const [callsData, messagesData, usersData] = await Promise.all(responses);

      if (!callsRes.ok) throw new Error(callsData.message || 'Failed to load call totals');
      if (!messagesRes.ok) throw new Error(messagesData.message || 'Failed to load message totals');
      if (usersRes && !usersRes.ok) throw new Error(usersData.message || 'Failed to load users');

      setCalls(Array.isArray(callsData) ? callsData : []);
      setMessages(Array.isArray(messagesData) ? messagesData : []);
      if (showUsers) {
        setUsers(Array.isArray(usersData) ? usersData : []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, showUsers]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const refresh = () => fetchDashboardData();
    window.addEventListener('refreshCallHistory', refresh);
    window.addEventListener('refreshMessages', refresh);

    return () => {
      window.removeEventListener('refreshCallHistory', refresh);
      window.removeEventListener('refreshMessages', refresh);
    };
  }, [fetchDashboardData]);

  const totals = useMemo(() => calls.reduce((acc, call) => {
    const callType = call.callType?.toLowerCase();
    const status = call.status?.toLowerCase();

    acc.total += 1;
    if (callType === 'inbound') acc.inbound += 1;
    if (callType === 'outbound') acc.outbound += 1;
    if (status === 'missed') acc.missed += 1;

    return acc;
  }, {
    total: 0,
    inbound: 0,
    outbound: 0,
    missed: 0
  }), [calls]);

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

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const createUser = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      setNotice({ text: 'Enter name, email, and a password with at least 6 characters.', type: 'error' });
      return;
    }

    try {
      setCreating(true);
      setNotice({ text: '', type: '' });

      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create user');

      setForm(emptyForm);
      setNotice({ text: `${data.user?.name || 'User'} created successfully.`, type: 'success' });
      fetchDashboardData();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading admin dashboard..." />;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {showStats && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Total Calls" value={totals.total} tone="total" />
            <StatCard label="Inbound Calls" value={totals.inbound} tone="inbound" />
            <StatCard label="Outbound Calls" value={totals.outbound} tone="outbound" />
            <StatCard label="Missed Calls" value={totals.missed} tone="missed" />
          </div>

          <div className="grid grid-cols-3 gap-3 pb-3">
            <StatCard label="Total Messages" value={messageTotals.total} tone="messages" />
            <StatCard label="Inbound Messages" value={messageTotals.inbound} tone="inbound" />
            <StatCard label="Outbound Messages" value={messageTotals.outbound} tone="outbound" />
          </div>
        </>
      )}

      {showCreateUser && (
        <form onSubmit={createUser} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-white">Create User</h3>
          <p className="text-xs text-gray-400">Add a user or admin account.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs text-gray-400">Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-blue-500"
              placeholder="Username"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-400">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-blue-500"
              placeholder="email@company.com"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-400">Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-blue-500"
              placeholder="Minimum 6 characters"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-400">Role</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-blue-500"
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {notice.text && (
          <div className={`mt-4 rounded-xl px-3 py-2 text-xs text-white ${
            notice.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}>
            {notice.text}
          </div>
        )}

        <button
          type="submit"
          disabled={creating}
          className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {creating ? <LoadingSpinner label="Creating..." size="sm" tone="white" inline /> : 'Create User'}
        </button>
        </form>
      )}

      {showUsers && (
        <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Created Users</h3>
          </div>

          {users.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No users created yet.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {users.map((user) => (
                <div key={user._id || user.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                    <p className="truncate text-xs text-gray-400">{user.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-gray-700 px-2.5 py-1 text-[11px] font-semibold capitalize text-gray-300">
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
