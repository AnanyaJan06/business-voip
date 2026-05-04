import { useState } from 'react';
import axios from 'axios';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password
      });

      localStorage.setItem('token', res.data.token);
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-4xl">
              📞
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white">VoIP Pro</h1>
          <p className="text-gray-400 mt-3 text-lg">Professional Business Phone System</p>
        </div>

        <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-700 rounded-3xl p-10 shadow-2xl">
          <h2 className="text-2xl font-semibold text-white text-center mb-8">Sign In</h2>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-gray-400 text-sm block mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl px-5 py-4 focus:border-blue-500 transition"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl px-5 py-4 focus:border-blue-500 transition"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-2xl text-lg transition disabled:opacity-70"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          First time? Register using Postman for now.
        </p>
      </div>
    </div>
  );
}

export default Login;