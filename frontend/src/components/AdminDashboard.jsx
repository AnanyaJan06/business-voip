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

function AdminDashboard() {
  const [calls, setCalls] = useState([]);
  const [messages, setMessages] = useState([]);
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

      const [callsRes, messagesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/calls/logs`, { headers: authHeaders }),
        fetch(`${BACKEND_URL}/api/messages`, { headers: authHeaders })
      ]);

      const [callsData, messagesData] = await Promise.all([
        callsRes.json(),
        messagesRes.json()
      ]);

      if (!callsRes.ok) throw new Error(callsData.message || 'Failed to load call totals');
      if (!messagesRes.ok) throw new Error(messagesData.message || 'Failed to load message totals');

      setCalls(Array.isArray(callsData) ? callsData : []);
      setMessages(Array.isArray(messagesData) ? messagesData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

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

    if (callType === 'inbound') acc.inbound += 1;
    if (callType === 'outbound') acc.outbound += 1;
    if (status === 'missed') acc.missed += 1;

    return acc;
  }, {
    inbound: 0,
    outbound: 0,
    missed: 0
  }), [calls]);

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

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Inbound Calls" value={totals.inbound} tone="inbound" />
        <StatCard label="Outbound Calls" value={totals.outbound} tone="outbound" />
        <StatCard label="Missed Calls" value={totals.missed} tone="missed" />
        <StatCard label="Messages" value={messages.length} tone="messages" />
      </div>

      <form onSubmit={createUser} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-white">Create User</h3>
          <p className="text-xs text-gray-400">Add an agent or admin account.</p>
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
    </div>
  );
}

export default AdminDashboard;
