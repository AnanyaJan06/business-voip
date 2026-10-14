import { useEffect, useState } from 'react';
import { AppSkeletonTheme, Skeleton } from '../components/ui/AppSkeleton.jsx';
import InlineLoader from '../components/ui/InlineLoader.jsx';
import { confirmAction } from '../utils/confirmDialog.js';
import { showErrorToast, showSuccessToast } from '../utils/toast.js';
import { ChevronRight, KeyRound, LayoutDashboard, MessageCircle, Moon, Sun } from 'lucide-react';

const BACKEND_URL = 'https://business-voip.onrender.com';

function SettingsSkeleton() {
  return (
    <AppSkeletonTheme>
      <div className="mx-auto max-w-xl" role="status" aria-label="Loading settings">
        <div className="mb-4 rounded-2xl border border-gray-700 bg-gray-900 p-4">
          <Skeleton width={142} height={18} className="mb-4 block" />
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                <Skeleton width={72} height={12} />
                <Skeleton width={index === 1 ? '72%' : '44%'} height={16} className="mt-2 block" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
          <Skeleton width={132} height={18} className="mb-4 block" />
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index}>
                <Skeleton width={116} height={12} />
                <Skeleton height={44} borderRadius={12} className="mt-2 block" />
              </div>
            ))}
            <Skeleton height={44} borderRadius={12} />
          </div>
        </div>
      </div>
    </AppSkeletonTheme>
  );
}

function Settings({ onNavigate, theme, onToggleTheme, isAdmin }) {
  const [user, setUser] = useState(null);
  const [assignedNumbers, setAssignedNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        };

        const [userRes, numbersRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/auth/me`, { headers }),
          fetch(`${BACKEND_URL}/api/phone-numbers/me`, { headers })
        ]);

        if (userRes.ok) {
          const data = await userRes.json();
          setUser(data);
        } else {
          throw new Error('Failed to load profile');
        }

        if (numbersRes.ok) {
          const data = await numbersRes.json();
          setAssignedNumbers(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        showErrorToast(error.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const defaultNumberId = assignedNumbers.find((number) => (
    number.sid === user?.assignedPhoneNumberSid || number.phoneNumber === user?.assignedPhoneNumber
  ))?.id || '';

  const handleDefaultNumberChange = async (event) => {
    const numberId = event.target.value;
    if (!numberId) return;

    const selectedNumber = assignedNumbers.find((number) => (
      String(number.id || number._id) === String(numberId)
    ));

    const confirmed = await confirmAction({
      title: 'Change default sender?',
      text: selectedNumber?.phoneNumber
        ? `${selectedNumber.phoneNumber} will be used for outbound SMS.`
        : 'This number will be used for outbound SMS.',
      confirmButtonText: 'Change'
    });

    if (!confirmed) return;

    try {
      setSavingDefault(true);
      const res = await fetch(`${BACKEND_URL}/api/phone-numbers/me/default`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ numberId })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to update default number');

      setUser((current) => ({
        ...current,
        assignedPhoneNumber: data.phoneNumber,
        assignedPhoneNumberSid: data.sid
      }));
      showSuccessToast(`${data.phoneNumber} is now your default sender`);
    } catch (error) {
      showErrorToast(error.message || 'Failed to update default number');
    } finally {
      setSavingDefault(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      showErrorToast('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      showErrorToast('Password must be at least 6 characters');
      return;
    }

    const confirmed = await confirmAction({
      title: 'Change password?',
      text: 'You will use the new password the next time you sign in.',
      confirmButtonText: 'Change Password'
    });

    if (!confirmed) return;

    try {
      setSavingPassword(true);
      const res = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (!res.ok) {
        throw new Error('Failed to change password. Check current password.');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSuccessToast('Password changed successfully');
    } catch (error) {
      showErrorToast(error.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 rounded-2xl border border-gray-700 bg-gray-900 p-4">
        <h3 className="mb-4 hidden text-base font-semibold text-white md:block">Profile Information</h3>
        <div className="flex flex-col gap-3 md:space-y-4 md:gap-0">
          <div className="order-1 flex items-start justify-between gap-3 md:block">
            <div className="min-w-0">
              <p className="mb-1 hidden text-xs text-gray-400 md:block">Name</p>
              <p className="truncate text-sm font-medium text-white">{user?.name || 'N/A'}</p>
            </div>
            <p className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize md:hidden ${user?.role === 'admin' ? 'border-violet-400/30 bg-violet-500/15 text-violet-300' : 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'}`}>{user?.role || 'Agent'}</p>
          </div>
          <div className="order-2 md:order-2">
            <p className="mb-1 hidden text-xs text-gray-400 md:block">Email</p>
            <p className="break-all text-sm font-medium text-white">{user?.email || 'N/A'}</p>
          </div>
          <div className="order-3 md:order-3">
            <p className="hidden text-xs text-gray-400 md:block">Role</p>
            <p className={`hidden text-sm font-medium capitalize md:mt-1 md:block ${user?.role === 'admin' ? 'text-violet-300' : 'text-emerald-300'}`}>{user?.role || 'Agent'}</p>
          </div>
          <div className="order-4">
            <label aria-label="Select default number" className="mb-1.5 hidden text-xs text-gray-400 md:block">Default Number</label>
            {assignedNumbers.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={defaultNumberId}
                  onChange={handleDefaultNumberChange}
                  disabled={savingDefault}
                  aria-label="Select default number"
                  className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669] disabled:opacity-60"
                >
                  {assignedNumbers.map((number) => (
                    <option key={number.id || number._id || number.sid} value={number.id || number._id}>
                      {number.phoneNumber}
                    </option>
                  ))}
                </select>
                {savingDefault && (
                  <span className="flex items-center rounded-xl border border-gray-700 px-3 text-xs text-gray-300">
                    <InlineLoader label="Saving..." size="xs" />
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm font-medium text-white">No numbers allotted</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2.5 md:hidden">
        <button type="button" onClick={() => setShowPasswordForm((open) => !open)} className="mobile-settings-action group flex min-h-14 items-center gap-3 rounded-2xl border border-gray-700/80 bg-gradient-to-r from-gray-900 to-gray-800/80 px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:border-emerald-500/50 hover:from-gray-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-300"><KeyRound className="h-4 w-4" /></span>
          <span className="flex-1">Change Password</span><ChevronRight className="h-4 w-4 text-gray-500 transition group-hover:translate-x-0.5 group-hover:text-gray-300" />
        </button>
        <button type="button" onClick={() => onNavigate?.('team')} className="mobile-settings-action group flex min-h-14 items-center gap-3 rounded-2xl border border-gray-700/80 bg-gradient-to-r from-gray-900 to-gray-800/80 px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:border-sky-500/50 hover:from-gray-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-300"><MessageCircle className="h-4 w-4" /></span>
          <span className="flex-1">Team Chat</span><ChevronRight className="h-4 w-4 text-gray-500 transition group-hover:translate-x-0.5 group-hover:text-gray-300" />
        </button>
        <button type="button" onClick={onToggleTheme} className="mobile-settings-action group flex min-h-14 items-center gap-3 rounded-2xl border border-gray-700/80 bg-gradient-to-r from-gray-900 to-gray-800/80 px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:border-amber-500/50 hover:from-gray-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-300">{theme === 'night' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</span>
          <span className="flex-1">{theme === 'night' ? 'Day Mode' : 'Night Mode'}</span><ChevronRight className="h-4 w-4 text-gray-500 transition group-hover:translate-x-0.5 group-hover:text-gray-300" />
        </button>
        {isAdmin && <button type="button" onClick={() => onNavigate?.('admin')} className="mobile-settings-action group flex min-h-14 items-center gap-3 rounded-2xl border border-gray-700/80 bg-gradient-to-r from-gray-900 to-gray-800/80 px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:border-violet-500/50 hover:from-gray-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-300"><LayoutDashboard className="h-4 w-4" /></span>
          <span className="flex-1">Admin</span><ChevronRight className="h-4 w-4 text-gray-500 transition group-hover:translate-x-0.5 group-hover:text-gray-300" />
        </button>}
      </div>

      <div className={`${showPasswordForm ? 'block' : 'hidden'} rounded-2xl border border-gray-700 bg-gray-900 p-4 md:block`}>
        <h3 className="mb-4 text-base font-semibold text-white">Change Password</h3>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-gray-400">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-gray-400">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-gray-400">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white focus:border-[#059669]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="w-full rounded-xl bg-[#059669] py-3 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:opacity-60"
          >
            {savingPassword ? <InlineLoader label="Changing..." /> : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Settings;
