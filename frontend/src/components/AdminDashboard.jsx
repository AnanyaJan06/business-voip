import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  UserPlus,
  Users,
  Phone,
  Check,
  CheckCircle2
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner.jsx';
import { AppSkeletonTheme, Skeleton } from './ui/AppSkeleton.jsx';
import { showSuccessToast, showErrorToast } from '../utils/toast.js';

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

const getMonthInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
};

const getDateRangeParams = (selectedMonthValue, selectedDateValue) => {
  const now = new Date();
  const [monthYear, monthNumber] = (selectedMonthValue || getMonthInputValue()).split('-').map(Number);
  const monthStart = new Date(monthYear || now.getFullYear(), (monthNumber || now.getMonth() + 1) - 1, 1);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
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
    total: 'admin-stat-emerald border-emerald-500/20 bg-[#059669]/10 text-emerald-300',
    inbound: 'admin-stat-emerald border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    outbound: 'admin-stat-emerald border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    missed: 'admin-stat-red border-red-500/20 bg-red-500/10 text-red-300',
    messages: 'admin-stat-violet border-violet-500/20 bg-violet-500/10 text-violet-300'
  };

  return (
    <div className={`admin-stat-card rounded-xl border p-4 transition-all duration-150 ${tones[tone]}`}>
      <p className="admin-stat-label text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="admin-stat-value mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function AdminDashboardSkeleton({ showStats, showCreateUser, showUsers }) {
  return (
    <AppSkeletonTheme>
      <div className="mx-auto max-w-5xl space-y-4" role="status" aria-label="Loading admin dashboard">
        {showStats && (
          <div className="admin-card rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <Skeleton width={140} height={18} />
                <Skeleton width={220} height={12} />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Skeleton width={80} height={12} className="mb-1.5" />
                  <Skeleton width={130} height={36} borderRadius={12} />
                </div>
                <div>
                  <Skeleton width={80} height={12} className="mb-1.5" />
                  <Skeleton width={130} height={36} borderRadius={12} />
                </div>
                <Skeleton width={85} height={36} borderRadius={12} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="admin-stat-card rounded-xl border border-gray-800 bg-gray-800/40 p-4 space-y-2">
                  <Skeleton width="60%" height={12} />
                  <Skeleton width="40%" height={28} />
                </div>
              ))}
            </div>
          </div>
        )}

        {showCreateUser && (
          <div className="admin-card rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="mb-4 space-y-1">
              <Skeleton width={120} height={20} />
              <Skeleton width={180} height={12} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton width={60} height={12} />
                  <Skeleton height={44} borderRadius={12} />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Skeleton height={44} borderRadius={12} />
            </div>
          </div>
        )}

        {showUsers && (
          <>
            <div className="admin-card rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Skeleton width={130} height={20} />
                  <Skeleton width={260} height={12} />
                </div>
                <Skeleton width={95} height={32} borderRadius={8} />
              </div>
              <div className="admin-table-container overflow-hidden rounded-xl border border-gray-800">
                <div className="admin-table-header border-b border-gray-800 px-4 py-3">
                  <Skeleton width={160} height={16} />
                </div>
                <div className="divide-y divide-gray-800">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_1.4fr] md:items-start">
                      <div className="space-y-1.5">
                        <Skeleton width={140} height={16} />
                        <Skeleton width={100} height={12} />
                        <Skeleton width={110} height={10} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Skeleton width={90} height={28} borderRadius={9999} />
                          <Skeleton width={110} height={28} borderRadius={9999} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Skeleton width={120} height={26} borderRadius={8} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-card admin-table-container overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
              <div className="admin-table-header border-b border-gray-800 px-4 py-3">
                <Skeleton width={120} height={16} />
              </div>
              <div className="divide-y divide-gray-800">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="space-y-2 min-w-0 flex-1">
                      <Skeleton width={140} height={16} />
                      <Skeleton width={180} height={12} />
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        <Skeleton width="80%" height={11} />
                        <Skeleton width="80%" height={11} />
                        <Skeleton width="70%" height={11} />
                        <Skeleton width="70%" height={11} />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Skeleton width={120} height={22} borderRadius={9999} />
                      </div>
                    </div>
                    <Skeleton width={60} height={22} borderRadius={9999} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </AppSkeletonTheme>
  );
}

function AdminDashboard({ showStats = true, showCreateUser = true, showUsers = true }) {
  const [activityStats, setActivityStats] = useState({
    month: { calls: 0, messages: 0 },
    selectedDate: { calls: 0, messages: 0 }
  });
  const [statsMonthInput, setStatsMonthInput] = useState(() => getMonthInputValue());
  const [statsDateInput, setStatsDateInput] = useState(() => getDateInputValue());
  const [appliedStatsMonth, setAppliedStatsMonth] = useState(() => getMonthInputValue());
  const [appliedStatsDate, setAppliedStatsDate] = useState(() => getDateInputValue());
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
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

      const statsParams = getDateRangeParams(appliedStatsMonth, appliedStatsDate);
      statsParams.set('refreshKey', String(statsRefreshKey));

      const statsPromise = showStats
        ? fetch(`${BACKEND_URL}/api/auth/admin-activity-stats?${statsParams}`, {
            headers: authHeaders
          })
        : Promise.resolve(null);
      const usersPromise = showUsers
        ? fetch(`${BACKEND_URL}/api/auth/users`, { headers: authHeaders })
        : Promise.resolve(null);
      const numbersPromise = showUsers
        ? fetch(`${BACKEND_URL}/api/phone-numbers`, { headers: authHeaders })
        : Promise.resolve(null);

      const [statsRes, usersRes, numbersRes] = await Promise.all([
        statsPromise,
        usersPromise,
        numbersPromise
      ]);

      const [statsData, usersData, numbersData] = await Promise.all([
        statsRes ? statsRes.json() : Promise.resolve(null),
        usersRes ? usersRes.json() : Promise.resolve(null),
        numbersRes ? numbersRes.json() : Promise.resolve(null)
      ]);

      if (statsRes && !statsRes.ok) throw new Error(statsData.message || 'Failed to load activity totals');
      if (usersRes && !usersRes.ok) throw new Error(usersData.message || 'Failed to load users');
      if (numbersRes && !numbersRes.ok) throw new Error(numbersData.message || 'Failed to load phone numbers');

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
  }, [appliedStatsDate, appliedStatsMonth, authHeaders, showStats, showUsers, statsRefreshKey]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const refreshStats = () => {
      if (showStats) {
        setStatsRefreshKey((current) => current + 1);
      }
    };

    window.addEventListener('refreshCallHistory', refreshStats);
    window.addEventListener('refreshMessages', refreshStats);

    return () => {
      window.removeEventListener('refreshCallHistory', refreshStats);
      window.removeEventListener('refreshMessages', refreshStats);
    };
  }, [showStats]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const refreshActivityStats = () => {
    setAppliedStatsMonth(statsMonthInput);
    setAppliedStatsDate(statsDateInput);
    setStatsRefreshKey((current) => current + 1);
    showSuccessToast('Activity stats refreshed');
  };

  const createUser = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      const msg = 'Enter name, email, and a password with at least 6 characters.';
      setNotice({ text: msg, type: 'error' });
      showErrorToast(msg);
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
      const successMsg = `${data.user?.name || 'User'} created successfully.`;
      setNotice({ text: successMsg, type: 'success' });
      showSuccessToast(successMsg);
      fetchDashboardData();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
      showErrorToast(err.message);
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
      const successMsg = `Synced ${Array.isArray(data) ? data.length : 0} purchased Twilio number${Array.isArray(data) && data.length === 1 ? '' : 's'}.`;
      setNotice({
        text: successMsg,
        type: 'success'
      });
      showSuccessToast(successMsg);
      fetchDashboardData();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
      showErrorToast(err.message);
    } finally {
      setSyncingNumbers(false);
    }
  };

  const getAssignedUserIds = (number) => {
    if (Array.isArray(number.assignedUsers) && number.assignedUsers.length > 0) {
      return number.assignedUsers.map((user) => user?._id || user?.id || user).filter(Boolean);
    }

    const legacyUserId = number.assignedTo?._id || number.assignedTo?.id || number.assignedTo || '';
    return legacyUserId ? [legacyUserId] : [];
  };

  const assignNumber = async (numberId, userIds) => {
    try {
      setAssigningNumber(numberId);
      setNotice({ text: '', type: '' });

      const res = await fetch(`${BACKEND_URL}/api/phone-numbers/${numberId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ userIds })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to assign phone number');

      const assignedCount = Array.isArray(userIds) ? userIds.length : 0;
      const successMsg = assignedCount > 0
        ? `${data.phoneNumber} assigned to ${assignedCount} user${assignedCount === 1 ? '' : 's'}.`
        : `${data.phoneNumber} unassigned.`;

      setNotice({
        text: successMsg,
        type: 'success'
      });
      showSuccessToast(successMsg);
      fetchDashboardData();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
      showErrorToast(err.message);
    } finally {
      setAssigningNumber('');
    }
  };

  const toggleNumberAssignment = (number, userId) => {
    const numberId = number.id || number._id;
    const currentUserIds = getAssignedUserIds(number).map((id) => String(id));
    const nextUserIds = currentUserIds.includes(String(userId))
      ? currentUserIds.filter((id) => id !== String(userId))
      : [...currentUserIds, String(userId)];

    assignNumber(numberId, nextUserIds);
  };

  const setDefaultNumber = async (numberId, userId) => {
    try {
      setSettingDefaultNumber(numberId);
      setNotice({ text: '', type: '' });

      const res = await fetch(`${BACKEND_URL}/api/phone-numbers/${numberId}/default`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to set default phone number');

      const selectedUser = users.find((user) => String(user._id || user.id) === String(userId));
      const successMsg = `${data.phoneNumber} is now default sender for ${selectedUser?.name || 'the user'}.`;
      setNotice({
        text: successMsg,
        type: 'success'
      });
      showSuccessToast(successMsg);
      fetchDashboardData();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
      showErrorToast(err.message);
    } finally {
      setSettingDefaultNumber('');
    }
  };

  const getUserAssignedNumbers = (userId) => ownedNumbers.filter((number) => (
    getAssignedUserIds(number).some((assignedId) => String(assignedId) === String(userId))
  ));

  if (loading) {
    return <AdminDashboardSkeleton showStats={showStats} showCreateUser={showCreateUser} showUsers={showUsers} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {notice.text && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-white shadow-sm transition-all duration-200 ${
          notice.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {notice.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-white" /> : null}
          <span>{notice.text}</span>
        </div>
      )}

      {showStats && (
        <div className="admin-card rounded-xl border border-gray-800 bg-gray-900 p-4 transition-all">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="admin-heading text-sm font-semibold text-white">Monthly Activity</h3>
              <p className="admin-subtext text-xs text-gray-400">Choose a month and date, then refresh the counts.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[auto_auto_auto] sm:items-end">
              <div>
                <label className="admin-label mb-1.5 block text-xs text-gray-400">Filter by month</label>
                <input
                  type="month"
                  value={statsMonthInput}
                  onChange={(event) => setStatsMonthInput(event.target.value)}
                  className="admin-input w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white transition focus:border-[#059669] sm:w-auto"
                />
              </div>
              <div>
                <label className="admin-label mb-1.5 block text-xs text-gray-400">Filter by date</label>
                <input
                  type="date"
                  value={statsDateInput}
                  onChange={(event) => setStatsDateInput(event.target.value)}
                  className="admin-input w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white transition focus:border-[#059669] sm:w-auto"
                />
              </div>
              <button
                type="button"
                onClick={refreshActivityStats}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#059669] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#047857] hover:shadow active:scale-95"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Selected Month Calls" value={activityStats.month.calls} tone="total" />
            <StatCard label="Selected Month Messages" value={activityStats.month.messages} tone="messages" />
            <StatCard label="Selected Date Calls" value={activityStats.selectedDate.calls} tone="outbound" />
            <StatCard label="Selected Date Messages" value={activityStats.selectedDate.messages} tone="messages" />
          </div>
        </div>
      )}

      {showCreateUser && (
        <form onSubmit={createUser} className="admin-card rounded-xl border border-gray-800 bg-gray-900 p-4 transition-all">
          <div className="mb-4">
            <h3 className="admin-heading text-base font-semibold text-white">Create User</h3>
            <p className="admin-subtext text-xs text-gray-400">Add a user or admin account.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="admin-label mb-1.5 block text-xs text-gray-400">Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className="admin-input w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white transition focus:border-[#059669]"
                placeholder="Username"
                required
              />
            </div>

            <div>
              <label className="admin-label mb-1.5 block text-xs text-gray-400">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="admin-input w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white transition focus:border-[#059669]"
                placeholder="email@company.com"
                required
              />
            </div>

            <div>
              <label className="admin-label mb-1.5 block text-xs text-gray-400">Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="admin-input w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white transition focus:border-[#059669]"
                placeholder="Minimum 6 characters"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="admin-label mb-1.5 block text-xs text-gray-400">Role</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="admin-input w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white transition focus:border-[#059669]"
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#059669] py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#047857] hover:shadow active:scale-[0.99] disabled:opacity-60"
          >
            {creating ? (
              <LoadingSpinner label="Creating..." size="sm" tone="white" inline />
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Create User</span>
              </>
            )}
          </button>
        </form>
      )}

      {showUsers && (
        <div className="admin-card rounded-xl border border-gray-800 bg-gray-900 p-4 transition-all">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#059669]" />
                <h3 className="admin-heading text-base font-semibold text-white">Twilio Numbers</h3>
              </div>
              <p className="admin-subtext text-xs text-gray-400 mt-1">Sync purchased Twilio numbers, assign the same number to multiple users, and choose each user's default sender.</p>
            </div>
            <button
              type="button"
              onClick={importNumbers}
              disabled={syncingNumbers}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#059669] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#047857] hover:shadow active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncingNumbers ? 'animate-spin' : ''}`} />
              <span>{syncingNumbers ? 'Syncing...' : 'Sync Twilio'}</span>
            </button>
          </div>

          <div className="admin-table-container overflow-hidden rounded-xl border border-gray-800">
            <div className="admin-table-header border-b border-gray-800 px-4 py-3">
              <h4 className="admin-heading text-sm font-semibold text-white">Purchased Twilio Numbers</h4>
            </div>
            {ownedNumbers.length === 0 ? (
              <p className="admin-empty-text py-8 text-center text-sm text-gray-400">Click Sync Twilio to import purchased numbers.</p>
            ) : (
              <div className="admin-table-body divide-y divide-gray-800">
                {ownedNumbers.map((number) => {
                  const numberId = number.id || number._id;
                  const assignedUserIds = getAssignedUserIds(number).map((id) => String(id));

                  return (
                    <div key={numberId || number.sid} className="admin-table-row grid gap-3 px-4 py-3 md:grid-cols-[1fr_1.4fr] md:items-start transition-colors">
                      <div className="min-w-0">
                        <p className="admin-row-title truncate text-sm font-semibold text-white">{number.phoneNumber}</p>
                        <p className="admin-row-subtext truncate text-xs text-gray-400">{number.friendlyName || number.sid}</p>
                        <p className="admin-row-count mt-1 text-[11px] text-gray-500">
                          {assignedUserIds.length > 0
                            ? `${assignedUserIds.length} user${assignedUserIds.length === 1 ? '' : 's'} assigned`
                            : 'No users assigned'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {users.map((user) => {
                            const userId = String(user._id || user.id);
                            const isAssigned = assignedUserIds.includes(userId);
                            const isDefault = isAssigned && (
                              user.assignedPhoneNumberSid === number.sid
                              || user.assignedPhoneNumber === number.phoneNumber
                            );

                            return (
                              <label
                                key={userId}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs select-none transition-all duration-150 active:scale-95 ${
                                  isAssigned
                                    ? 'admin-user-pill-assigned border-emerald-500/40 bg-emerald-500/10 text-emerald-100 font-medium'
                                    : 'admin-user-pill-unassigned border-gray-700 bg-gray-800 text-gray-300'
                                } ${assigningNumber === numberId ? 'opacity-60' : 'cursor-pointer hover:border-emerald-500/60'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  disabled={assigningNumber === numberId}
                                  onChange={() => toggleNumberAssignment(number, userId)}
                                  className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-900 text-[#059669] focus:ring-[#059669]"
                                />
                                <span>{user.name}</span>
                                {isDefault && <span className="admin-default-tag text-[10px] uppercase font-bold tracking-wide text-emerald-300">default</span>}
                              </label>
                            );
                          })}
                        </div>
                        {assignedUserIds.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            {assignedUserIds.map((userId) => {
                              const assignedUser = users.find((user) => String(user._id || user.id) === userId);
                              const isDefault = assignedUser?.assignedPhoneNumberSid === number.sid
                                || assignedUser?.assignedPhoneNumber === number.phoneNumber;

                              return (
                                <button
                                  key={`${numberId}-${userId}`}
                                  type="button"
                                  onClick={() => setDefaultNumber(numberId, userId)}
                                  disabled={isDefault || settingDefaultNumber === numberId || assigningNumber === numberId}
                                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-150 active:scale-95 disabled:opacity-60 ${
                                    isDefault
                                      ? 'admin-default-btn-active border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 cursor-default'
                                      : 'admin-default-btn-idle border border-gray-700 bg-gray-800 text-gray-200 hover:border-emerald-500/60 hover:text-white'
                                  }`}
                                >
                                  {isDefault ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-400" />
                                      <span>{assignedUser?.name || 'User'} default</span>
                                    </>
                                  ) : settingDefaultNumber === numberId ? (
                                    'Saving...'
                                  ) : (
                                    `Set default for ${assignedUser?.name || 'user'}`
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showUsers && (
        <div className="admin-card admin-table-container overflow-hidden rounded-xl border border-gray-800 bg-gray-900 transition-all">
          <div className="admin-table-header border-b border-gray-800 px-4 py-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-[#059669]" />
            <h3 className="admin-heading text-sm font-semibold text-white">Created Users</h3>
          </div>

          {users.length === 0 ? (
            <p className="admin-empty-text py-10 text-center text-sm text-gray-400">No users created yet.</p>
          ) : (
            <div className="admin-table-body divide-y divide-gray-800">
              {users.map((user) => {
                const userId = user._id || user.id;
                const assignedNumbers = getUserAssignedNumbers(userId);

                return (
                  <div key={userId} className="admin-table-row flex items-start justify-between gap-3 px-4 py-3 transition-colors">
                    <div className="min-w-0">
                      <p className="admin-row-title truncate text-sm font-semibold text-white">{user.name}</p>
                      <p className="admin-row-subtext truncate text-xs text-gray-400">{user.email}</p>
                      <div className="mt-2 grid gap-1 text-[11px] text-gray-400 sm:grid-cols-2">
                        <p className="admin-user-meta break-words">
                          <span className="admin-user-meta-label text-gray-500">Login IP:</span> <span className="admin-user-meta-value">{user.lastLoginIp || 'Not recorded'}</span>
                        </p>
                        <p className="admin-user-meta break-words">
                          <span className="admin-user-meta-label text-gray-500">Logout IP:</span> <span className="admin-user-meta-value">{user.lastLogoutIp || 'Not recorded'}</span>
                        </p>
                        <p className="admin-user-meta break-words">
                          <span className="admin-user-meta-label text-gray-500">Last login:</span> <span className="admin-user-meta-value">{formatDateTime(user.lastLoginAt)}</span>
                        </p>
                        <p className="admin-user-meta break-words">
                          <span className="admin-user-meta-label text-gray-500">Last logout:</span> <span className="admin-user-meta-value">{formatDateTime(user.lastLogoutAt)}</span>
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
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                                  isDefault
                                    ? 'admin-user-number-pill-default border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                    : 'admin-user-number-pill border-gray-700 text-gray-300'
                                }`}
                              >
                                {number.phoneNumber}{isDefault ? ' (default)' : ''}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="admin-user-no-numbers mt-1 text-xs text-gray-500">No numbers assigned</p>
                      )}
                    </div>
                    <span className="admin-role-badge shrink-0 rounded-full border border-gray-700 px-2.5 py-1 text-[11px] font-semibold capitalize text-gray-300">
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
