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
    total: 'border-emerald-500/20 bg-[#059669]/10 text-emerald-300',
    inbound: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
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
  const [ownedNumbers, setOwnedNumbers] = useState([]);
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [numberSearch, setNumberSearch] = useState({ areaCode: '', contains: '', limit: '10' });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [buyingNumber, setBuyingNumber] = useState('');
  const [assigningNumber, setAssigningNumber] = useState('');
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
        requests.push(fetch(`${BACKEND_URL}/api/phone-numbers`, { headers: authHeaders }));
      }

      const [callsRes, messagesRes, usersRes, numbersRes] = await Promise.all(requests);

      const responses = [
        callsRes.json(),
        messagesRes.json()
      ];

      if (usersRes) {
        responses.push(usersRes.json());
      }
      if (numbersRes) {
        responses.push(numbersRes.json());
      }

      const [callsData, messagesData, usersData, numbersData] = await Promise.all(responses);

      if (!callsRes.ok) throw new Error(callsData.message || 'Failed to load call totals');
      if (!messagesRes.ok) throw new Error(messagesData.message || 'Failed to load message totals');
      if (usersRes && !usersRes.ok) throw new Error(usersData.message || 'Failed to load users');
      if (numbersRes && !numbersRes.ok) throw new Error(numbersData.message || 'Failed to load phone numbers');

      setCalls(Array.isArray(callsData) ? callsData : []);
      setMessages(Array.isArray(messagesData) ? messagesData : []);
      if (showUsers) {
        setUsers(Array.isArray(usersData) ? usersData : []);
        setOwnedNumbers(Array.isArray(numbersData) ? numbersData : []);
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

  const handleNumberSearchChange = (event) => {
    const { name, value } = event.target;
    setNumberSearch((current) => ({ ...current, [name]: value }));
  };

  const searchNumbers = async (event) => {
    event.preventDefault();

    try {
      setSearchingNumbers(true);
      setNotice({ text: '', type: '' });

      const params = new URLSearchParams();
      if (numberSearch.areaCode.trim()) params.set('areaCode', numberSearch.areaCode.trim());
      if (numberSearch.contains.trim()) params.set('contains', numberSearch.contains.trim());
      params.set('limit', numberSearch.limit || '10');

      const res = await fetch(`${BACKEND_URL}/api/phone-numbers/available?${params.toString()}`, {
        headers: authHeaders
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to search Twilio numbers');

      setAvailableNumbers(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length === 0) {
        setNotice({ text: 'No US numbers found for that search.', type: 'error' });
      }
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setSearchingNumbers(false);
    }
  };

  const importNumbers = async () => {
    try {
      setSearchingNumbers(true);
      setNotice({ text: '', type: '' });

      const res = await fetch(`${BACKEND_URL}/api/phone-numbers/import`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to import Twilio numbers');

      setOwnedNumbers(Array.isArray(data) ? data : []);
      setNotice({ text: 'Twilio numbers imported successfully.', type: 'success' });
      fetchDashboardData();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setSearchingNumbers(false);
    }
  };

  const buyNumber = async (phoneNumber) => {
    try {
      setBuyingNumber(phoneNumber);
      setNotice({ text: '', type: '' });

      const res = await fetch(`${BACKEND_URL}/api/phone-numbers/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          phoneNumber,
          userId: selectedUserId
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to buy Twilio number');

      setAvailableNumbers((current) => current.filter((number) => number.phoneNumber !== phoneNumber));
      setNotice({ text: `${phoneNumber} purchased successfully.`, type: 'success' });
      fetchDashboardData();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setBuyingNumber('');
    }
  };

  const assignNumber = async (numberId, userId) => {
    try {
      setAssigningNumber(numberId);
      setNotice({ text: '', type: '' });

      const res = await fetch(`${BACKEND_URL}/api/phone-numbers/${numberId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to assign phone number');

      setNotice({ text: userId ? `${data.phoneNumber} assigned successfully.` : `${data.phoneNumber} unassigned.`, type: 'success' });
      fetchDashboardData();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setAssigningNumber('');
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
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
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
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
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
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
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
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
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
          className="mt-4 w-full rounded-xl bg-[#059669] py-3 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:opacity-60"
        >
          {creating ? <LoadingSpinner label="Creating..." size="sm" tone="white" inline /> : 'Create User'}
        </button>
        </form>
      )}

      {showUsers && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">Twilio Numbers</h3>
              <p className="text-xs text-gray-400">Buy US numbers and assign one number to each user.</p>
            </div>
            <button
              type="button"
              onClick={importNumbers}
              disabled={searchingNumbers}
              className="shrink-0 rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-gray-800 disabled:opacity-60"
            >
              Import
            </button>
          </div>

          <form onSubmit={searchNumbers} className="grid gap-3 md:grid-cols-[1fr_1fr_90px_auto]">
            <input
              name="areaCode"
              value={numberSearch.areaCode}
              onChange={handleNumberSearchChange}
              maxLength={3}
              className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
              placeholder="Area code"
            />
            <input
              name="contains"
              value={numberSearch.contains}
              onChange={handleNumberSearchChange}
              className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
              placeholder="Contains"
            />
            <input
              name="limit"
              type="number"
              min="1"
              max="20"
              value={numberSearch.limit}
              onChange={handleNumberSearchChange}
              className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
            />
            <button
              type="submit"
              disabled={searchingNumbers}
              className="rounded-xl bg-[#059669] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:opacity-60"
            >
              {searchingNumbers ? 'Searching...' : 'Search'}
            </button>
          </form>

          <div className="mt-3">
            <label className="mb-1.5 block text-xs text-gray-400">Assign new purchases to</label>
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
            >
              <option value="">Buy without assigning</option>
              {users.map((user) => (
                <option key={user._id || user.id} value={user._id || user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {availableNumbers.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-800">
              <div className="divide-y divide-gray-800">
                {availableNumbers.map((number) => (
                  <div key={number.phoneNumber} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{number.phoneNumber}</p>
                      <p className="truncate text-xs text-gray-400">{[number.locality, number.region].filter(Boolean).join(', ') || 'United States'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => buyNumber(number.phoneNumber)}
                      disabled={buyingNumber === number.phoneNumber}
                      className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {buyingNumber === number.phoneNumber ? 'Buying...' : 'Buy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-xl border border-gray-800">
            <div className="border-b border-gray-800 px-4 py-3">
              <h4 className="text-sm font-semibold text-white">Owned Numbers</h4>
            </div>
            {ownedNumbers.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No Twilio numbers imported or purchased yet.</p>
            ) : (
              <div className="divide-y divide-gray-800">
                {ownedNumbers.map((number) => {
                  const numberId = number.id || number._id;
                  const assignedId = number.assignedTo?._id || number.assignedTo?.id || number.assignedTo || '';

                  return (
                    <div key={numberId || number.sid} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_1.4fr] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{number.phoneNumber}</p>
                        <p className="truncate text-xs text-gray-400">{number.friendlyName || number.sid}</p>
                      </div>
                      <select
                        value={assignedId}
                        onChange={(event) => assignNumber(numberId, event.target.value)}
                        disabled={assigningNumber === numberId}
                        className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669] disabled:opacity-60"
                      >
                        <option value="">Unassigned</option>
                        {users.map((user) => (
                          <option key={user._id || user.id} value={user._id || user.id}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
                    {user.assignedPhoneNumber && (
                      <p className="truncate text-xs text-emerald-300">{user.assignedPhoneNumber}</p>
                    )}
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
