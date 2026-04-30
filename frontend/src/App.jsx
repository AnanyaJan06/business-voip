import { useState, useEffect } from 'react';
import Dialer from './components/Dialer.jsx';
import CallHistory from './components/CallHistory.jsx';
import Contacts from './components/Contacts.jsx';
import Login from './pages/Login.jsx';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('dialer');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState(''); // For click-to-call

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    setToken(storedToken);
  }, []);

  // Handle Click-to-Call from Contacts
  useEffect(() => {
    const handleCallContact = (event) => {
      const { phoneNumber } = event.detail;
      setSelectedPhoneNumber(phoneNumber);
      setActiveTab('dialer');
    };

    window.addEventListener('callContact', handleCallContact);

    return () => window.removeEventListener('callContact', handleCallContact);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setActiveTab('dialer');
    setSelectedPhoneNumber('');
  };

  if (!token) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <div className="w-72 bg-gray-900 border-r border-gray-800 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl">
            📞
          </div>
          <h1 className="text-3xl font-bold">VoIP Pro</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <div 
            onClick={() => setActiveTab('dialer')}
            className={`flex items-center gap-3 px-5 py-4 rounded-2xl cursor-pointer transition-all ${
              activeTab === 'dialer' 
                ? 'bg-blue-600 text-white' 
                : 'hover:bg-gray-800 text-gray-300'
            }`}
          >
            📞 Dialer
          </div>

          <div 
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-3 px-5 py-4 rounded-2xl cursor-pointer transition-all ${
              activeTab === 'history' 
                ? 'bg-blue-600 text-white' 
                : 'hover:bg-gray-800 text-gray-300'
            }`}
          >
            📜 Call History
          </div>

          <div 
            onClick={() => setActiveTab('contacts')}
            className={`flex items-center gap-3 px-5 py-4 rounded-2xl cursor-pointer transition-all ${
              activeTab === 'contacts' 
                ? 'bg-blue-600 text-white' 
                : 'hover:bg-gray-800 text-gray-300'
            }`}
          >
            👥 Contacts
          </div>
        </nav>

        <div className="mt-auto pt-8 border-t border-gray-800">
          <button 
            onClick={logout}
            className="w-full text-red-400 hover:text-red-500 py-3 rounded-2xl hover:bg-red-950/50 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-gray-800 bg-gray-900 flex items-center px-10 justify-between">
          <h2 className="text-2xl font-semibold">
            {activeTab === 'dialer' && 'Dialer'}
            {activeTab === 'history' && 'Call History'}
            {activeTab === 'contacts' && 'Contacts'}
          </h2>
          <div className="flex items-center gap-3">
            <div className="text-sm text-green-500 font-medium">● Online</div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-10 bg-gray-950">
          {activeTab === 'dialer' && <Dialer selectedPhoneNumber={selectedPhoneNumber} />}
          {activeTab === 'history' && <CallHistory />}
          {activeTab === 'contacts' && <Contacts />}
        </main>
      </div>
    </div>
  );
}

export default App;
