import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from './LoadingSpinner.jsx';

const BACKEND_URL = 'https://business-voip.onrender.com';

const emptyForm = { 
  name: '',
  email: '',
  password: '',
  role: 'agent'
};

const getDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getDateRangeParams = (selectedDateValue) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const selectedDate = selectedDateValue
    ? new Date(`${selectedDateValue}T00:00:00`)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateEnd = new Date(selectedDate);
  dateEnd.setDate(dateEnd.getDate() + 1);

  return new URLSearchParams({
    monthStart: monthStart.toISOString(),
    monthEnd: monthEnd.toISOString(),
    dateStart: selectedDate.toISOString(),
    dateEnd: dateEnd.toISOString()
  });
};

const formatDateTime = (value) => {
  if (!value) return 'Never';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
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
  const [activityStats, setActivityStats] = useState({
    month: { calls: 0, messages: 0 },
    selectedDate: { calls: 0, messages: 0 }
  });
  const [selectedStatsDate, setSelectedStatsDate] = useState(() => getDateInputValue());
  const [users, setUsers] = useState([]);
  const [ownedNumbers, setOwnedNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [syncingNumbers, setSyncingNumbers] = useState(false);
  const [assigningNumber, setAssigningNumber] = useState('');
  const [settingDefaultNumber, setSettingDefaultNumber] = useState('');
  const [notice, setNotice] = useState({ text: '', type: '' });

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }), []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const callsPromise = fetch(`${BACKEND_URL}/api/calls/logs`, { headers: authHeaders });
      const messagesPromise = fetch(`${BACKEND_URL}/api/messages`, { headers: authHeaders });
      const statsPromise = showStats
        ? fetch(`${BACKEND_URL}/api/auth/admin-activity-stats?${getDateRangeParams(selectedStatsDate)}`, {
            headers: authHeaders
          })
        : Promise.resolve(null);
      const usersPromise = showUsers
        ? fetch(`${BACKEND_URL}/api/auth/users`, { headers: authHeaders })
        : Promise.resolve(null);
      const numbersPromise = showUsers
        ? fetch(`${BACKEND_URL}/api/phone-numbers`, { headers: authHeaders })
        : Promise.resolve(null);

      const [callsRes, messagesRes, statsRes, usersRes, numbersRes] = await Promise.all([
        callsPromise,
        messagesPromise,
        statsPromise,
        usersPromise,
        numbersPromise
      ]);

      const [callsData, messagesData, statsData, usersData, numbersData] = await Promise.all([
        callsRes.json(),
        messagesRes.json(),
        statsRes ? statsRes.json() : Promise.resolve(null),
        usersRes ? usersRes.json() : Promise.resolve(null),
        numbersRes ? numbersRes.json() : Promise.resolve(null)
      ]);

      if (!callsRes.ok) throw new Error(callsData.message || 'Failed to load call totals');
      if (!messagesRes.ok) throw new Error(messagesData.message || 'Failed to load message totals');
      if (statsRes && !statsRes.ok) throw new Error(statsData.message || 'Failed to load activity totals');
      if (usersRes && !usersRes.ok) throw new Error(usersData.message || 'Failed to load users');
      if (numbersRes && !numbersRes.ok) throw new Error(numbersData.message || 'Failed to load phone numbers');

      setCalls(Array.isArray(callsData) ? callsData : []);
      setMessages(Array.isArray(messagesData) ? messagesData : []);
      if (showStats) {
        setActivityStats({
          month: {
            calls: Number(statsData?.month?.calls) || 0,
            messages: Number(statsData?.month?.messages) || 0
          },
          selectedDate: {
            calls: Number(statsData?.selectedDate?.calls) || 0,
            messages: Number(statsData?.selectedDate?.messages) || 0
          }
        });
      }
      if (showUsers) {
        setUsers(Array.isArray(usersData) ? usersData : []);
        setOwnedNumbers(Array.isArray(numbersData) ? numbersData : []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, selectedStatsDate, showStats, showUsers]);

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

  const importNumbers = async () => {
    try {
      setSyncingNumbers(true);
      setNotice({ text: '', type: '' });

      const res = await fetch(`${BACKEND_URL}/api/phone-numbers/import`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to import Twilio numbers');

      setOwnedNumbers(Array.isArray(data) ? data : []);
      setNotice({
        text: `Synced ${Array.isArray(data) ? data.length : 0} purchased Twilio number${Array.isArray(data) && data.length === 1 ? '' : 's'}.`,
        type: 'success'
      });
      fetchDashboardData();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setSyncingNumbers(false);
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

  const setDefaultNumber = async (numberId) => {
    try {
      setSettingDefaultNumber(numberId);
      setNotice({ text: '', type: '' });

      const res = await fetch(`${BACKEND_URL}/api/phone-numbers/${numberId}/default`, {
        method: 'PATCH',
        headers: authHeaders
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to set default phone number');

      setNotice({ text: `${data.phoneNumber} is now the default sender.`, type: 'success' });
      fetchDashboardData();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setSettingDefaultNumber('');
    }
  };

  const getUserAssignedNumbers = (userId) => ownedNumbers.filter((number) => {
    const assignedId = number.assignedTo?._id || number.assignedTo?.id || number.assignedTo || '';
    return String(assignedId) === String(userId);
  });

  if (loading) return <LoadingSpinner label="Loading admin dashboard..." />;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {notice.text && (
        <div className={`rounded-xl px-4 py-3 text-sm text-white ${
          notice.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {notice.text}
        </div>
      )}

      {showStats && (
        <>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Monthly Activity</h3>
                <p className="text-xs text-gray-400">Counts for this month and the selected date.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-gray-400">Filter by date</label>
                <input
                  type="date"
                  value={selectedStatsDate}
                  onChange={(event) => setSelectedStatsDate(event.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-[#059669] sm:w-auto"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="This Month Calls" value={activityStats.month.calls} tone="total" />
              <StatCard label="This Month Messages" value={activityStats.month.messages} tone="messages" />
              <StatCard label="Selected Date Calls" value={activityStats.selectedDate.calls} tone="outbound" />
              <StatCard label="Selected Date Messages" value={activityStats.selectedDate.messages} tone="messages" />
            </div>
          </div>

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
              <p className="text-xs text-gray-400">Sync purchased Twilio numbers, assign multiple numbers, and choose each user's default sender.</p>
            </div>
            <button
              type="button"
              onClick={importNumbers}
              disabled={syncingNumbers}
              className="shrink-0 rounded-lg bg-[#059669] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#047857] disabled:opacity-60"
            >
              {syncingNumbers ? 'Syncing...' : 'Sync Twilio'}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-800">
            <div className="border-b border-gray-800 px-4 py-3">
              <h4 className="text-sm font-semibold text-white">Purchased Twilio Numbers</h4>
            </div>
            {ownedNumbers.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Click Sync Twilio to import purchased numbers.</p>
            ) : (
              <div className="divide-y divide-gray-800">
                {ownedNumbers.map((number) => {
                  const numberId = number.id || number._id;
                  const assignedId = number.assignedTo?._id || number.assignedTo?.id || number.assignedTo || '';
                  const assignedUser = users.find((user) => String(user._id || user.id) === String(assignedId));
                  const isDefault = assignedUser?.assignedPhoneNumberSid === number.sid
                    || assignedUser?.assignedPhoneNumber === number.phoneNumber;

                  return (
                    <div key={numberId || number.sid} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_1.2fr_auto] md:items-center">
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
                      <button
                        type="button"
                        onClick={() => setDefaultNumber(numberId)}
                        disabled={!assignedId || isDefault || settingDefaultNumber === numberId || assigningNumber === numberId}
                        className={`rounded-xl px-4 py-3 text-xs font-semibold transition disabled:opacity-60 ${
                          isDefault
                            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border border-gray-700 bg-gray-800 text-gray-200 hover:border-emerald-500/60 hover:text-white'
                        }`}
                      >
                        {isDefault ? 'Default' : settingDefaultNumber === numberId ? 'Saving...' : 'Set Default'}
                      </button>
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
              {users.map((user) => {
                const userId = user._id || user.id;
                const assignedNumbers = getUserAssignedNumbers(userId);

                return (
                  <div key={userId} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                      <p className="truncate text-xs text-gray-400">{user.email}</p>
                      <div className="mt-2 grid gap-1 text-[11px] text-gray-400 sm:grid-cols-2">
                        <p className="break-words">
                          <span className="text-gray-500">Login IP:</span> {user.lastLoginIp || 'Not recorded'}
                        </p>
                        <p className="break-words">
                          <span className="text-gray-500">Logout IP:</span> {user.lastLogoutIp || 'Not recorded'}
                        </p>
                        <p className="break-words">
                          <span className="text-gray-500">Last login:</span> {formatDateTime(user.lastLoginAt)}
                        </p>
                        <p className="break-words">
                          <span className="text-gray-500">Last logout:</span> {formatDateTime(user.lastLogoutAt)}
                        </p>
                      </div>
                      {assignedNumbers.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {assignedNumbers.map((number) => {
                            const isDefault = user.assignedPhoneNumberSid === number.sid
                              || user.assignedPhoneNumber === number.phoneNumber;

                            return (
                              <span
                                key={number.id || number._id || number.sid}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                  isDefault
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                    : 'border-gray-700 text-gray-300'
                                }`}
                              >
                                {number.phoneNumber}{isDefault ? ' default' : ''}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500">No numbers assigned</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full border border-gray-700 px-2.5 py-1 text-[11px] font-semibold capitalize text-gray-300">
                      {user.role}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
