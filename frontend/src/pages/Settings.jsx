import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

const BACKEND_URL = 'https://business-voip.onrender.com';

function Settings() {
  const [user, setUser] = useState(null);
  const [assignedNumbers, setAssignedNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingDefault, setSavingDefault] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Fetch current user info
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const headers = {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        };

        const [userRes, numbersRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/auth/me`, { headers }),
          fetch(`${BACKEND_URL}/api/phone-numbers/me`, { headers })
        ]);

        if (userRes.ok) {
          const data = await userRes.json();
          setUser(data);
        }

        if (numbersRes.ok) {
          const data = await numbersRes.json();
          setAssignedNumbers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleDefaultNumberChange = async (event) => {
    const numberId = event.target.value;
    if (!numberId) return;

    try {
      setSavingDefault(true);
      setMessage({ text: '', type: '' });

      const res = await fetch(`${BACKEND_URL}/api/phone-numbers/me/default`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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
      setMessage({ text: `${data.phoneNumber} is now your default sender.`, type: 'success' });
      } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSavingDefault(false);
    }
  };

  const defaultNumberId = assignedNumbers.find((number) => (
    number.sid === user?.assignedPhoneNumberSid || number.phoneNumber === user?.assignedPhoneNumber
  ))?.id || '';

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ text: "New passwords do not match", type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ text: "Password must be at least 6 characters", type: 'error' });
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (res.ok) {
        setMessage({ text: "✅ Password changed successfully!", type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ text: "Failed to change password. Check current password.", type: 'error' });
      }
    } catch {
      setMessage({ text: "Failed to change password", type: 'error' });
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading settings..." />;
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* <h2 className="text-3xl font-bold text-white mb-10">Settings</h2> */}

      {/* Profile Information */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 mb-4">
        <h3 className="text-base font-semibold mb-4 text-white">Profile Information</h3>
        <div className="space-y-4">
          <div>
            <p className="text-gray-400 text-xs">Name</p>
            <p className="text-white text-sm font-medium">{user?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Email</p>
            <p className="text-white text-sm font-medium break-all">{user?.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Role</p>
            <p className="text-white text-sm font-medium capitalize">{user?.role || 'Agent'}</p>
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1.5">Default Number</label>
            {assignedNumbers.length > 0 ? (
              <select
                value={defaultNumberId}
                onChange={handleDefaultNumberChange}
                disabled={savingDefault}
                className="w-full bg-gray-800 border border-gray-700 text-sm text-white rounded-xl px-4 py-3 focus:border-[#059669] disabled:opacity-60"
              >
                {assignedNumbers.map((number) => (
                  <option key={number.id || number._id || number.sid} value={number.id || number._id}>
                    {number.phoneNumber}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-white text-sm font-medium">No numbers allotted</p>
            )}
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
        <h3 className="text-base font-semibold mb-4 text-white">Change Password</h3>
        
        {message.text && (
          <div className={`p-3 rounded-xl mb-4 ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-sm text-white`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs block mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-sm text-white rounded-xl px-4 py-3 focus:border-[#059669]"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-sm text-white rounded-xl px-4 py-3 focus:border-[#059669]"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-sm text-white rounded-xl px-4 py-3 focus:border-[#059669]"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-[#059669] hover:bg-[#047857] py-3 rounded-xl text-sm text-white font-semibold transition"
          >
            Change Password
          </button>
        </form>
      </div>
    </div>
  );
}

export default Settings;
