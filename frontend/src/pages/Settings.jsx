import { useState, useEffect } from 'react';

const BACKEND_URL = 'https://business-voip.onrender.com';

function Settings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Fetch current user info
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

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
    } catch (err) {
      setMessage({ text: "Failed to change password", type: 'error' });
    }
  };

  if (loading) {
    return <p className="text-gray-400 text-center py-10">Loading settings...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* <h2 className="text-3xl font-bold text-white mb-10">Settings</h2> */}

      {/* Profile Information */}
      <div className="bg-gray-900 border border-gray-700 rounded-3xl p-8 mb-8">
        <h3 className="text-xl font-semibold mb-6 text-white">Profile Information</h3>
        <div className="space-y-6">
          <div>
            <p className="text-gray-400 text-sm">Name</p>
            <p className="text-white text-xl">{user?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Email</p>
            <p className="text-white text-xl">{user?.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Role</p>
            <p className="text-white text-xl capitalize">{user?.role || 'Agent'}</p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-gray-900 border border-gray-700 rounded-3xl p-8">
        <h3 className="text-xl font-semibold mb-6 text-white">Change Password</h3>
        
        {message.text && (
          <div className={`p-4 rounded-2xl mb-6 ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-6">
          <div>
            <label className="text-gray-400 text-sm block mb-2">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl px-5 py-4 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl px-5 py-4 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm block mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl px-5 py-4 focus:border-blue-500"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-2xl text-white font-semibold transition"
          >
            Change Password
          </button>
        </form>
      </div>
    </div>
  );
}

export default Settings;