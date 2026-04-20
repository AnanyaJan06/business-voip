import { useState, useEffect } from 'react';
import Dialer from './components/Dialer.jsx';
import Login from './pages/Login.jsx';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    setToken(storedToken);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  if (!token) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl">📞</div>
          <h1 className="text-2xl font-bold text-gray-900">VoIP Pro</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-2xl font-medium">
            📞 Dialer
          </div>
          <div className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-2xl cursor-pointer">
            📜 Call History
          </div>
          <div className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-2xl cursor-pointer">
            👥 Contacts
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t">
          <button 
            onClick={logout}
            className="w-full text-red-600 text-sm py-2 hover:bg-red-50 rounded-xl"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b bg-white flex items-center px-8 justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Dialer</h2>
          <div className="text-sm text-green-600 font-medium">● Online</div>
        </header>

        <main className="flex-1 p-8 overflow-auto">
          <Dialer />
        </main>
      </div>
    </div>
  );
}

export default App;
