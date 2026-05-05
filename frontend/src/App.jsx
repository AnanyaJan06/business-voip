import { useState, useEffect } from 'react';
import Dialer from './components/Dialer.jsx';
import CallHistory from './components/CallHistory.jsx';
import Contacts from './components/Contacts.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('history');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDialerModal, setShowDialerModal] = useState(false);   // ← New state

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    setToken(storedToken);
  }, []);

  // Click-to-Call from Contacts
  useEffect(() => {
    const handleCallContact = (event) => {
      const { phoneNumber } = event.detail;
      setSelectedPhoneNumber(phoneNumber);
      setShowDialerModal(true);        // Open Dialer as popup
    };
    window.addEventListener('callContact', handleCallContact);
    return () => window.removeEventListener('callContact', handleCallContact);
  }, []);

  const openNewCall = () => {
    setSelectedPhoneNumber('');
    setShowDialerModal(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setShowLogoutModal(false);
    setSelectedPhoneNumber('');
  };

  if (!token) return <Login />;

  return (
    <div className="flex h-screen bg-[#0A0C14] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-[#11151F] border-r border-gray-800 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-gray-800">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-400 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
            📞
          </div>
          <h1 className="text-3xl font-bold tracking-tighter">VoIP Pro</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'history', label: 'Calls', icon: '📞' },
            { id: 'contacts', label: 'Contacts', icon: '👥' },
            { id: 'messages', label: 'Messages', icon: '✉️' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-5 py-4 rounded-2xl cursor-pointer text-[15px] font-medium transition-all
                ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-800 text-gray-300'}`}
            >
              <span className="text-xl w-6">{item.icon}</span>
              {item.label}
            </div>
          ))}

          {/* + New Call Button */}
          <div
            onClick={openNewCall}
            className="flex items-center gap-3 px-5 py-4 mt-6 rounded-2xl cursor-pointer text-[15px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg"
          >
            <span className="text-xl w-6">+</span>
            New Call
          </div>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={() => setShowLogoutModal(true)}
            className="w-full py-3.5 text-red-400 hover:bg-red-950/30 rounded-2xl transition font-medium"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Middle Panel */}
      <div className="w-[440px] border-r border-gray-800 bg-[#161B28] flex flex-col">
        <div className="h-16 border-b border-gray-800 flex items-center px-6 bg-[#1C2333]">
          <h2 className="text-xl font-semibold">
            {activeTab === 'history' && 'Call History'}
            {activeTab === 'contacts' && 'Contacts'}
            {activeTab === 'messages' && 'Messages'}
            {activeTab === 'settings' && 'Settings'}
          </h2>
        </div>

        <div className="flex-1 overflow-auto thin-scrollbar p-3">
          {activeTab === 'history' && <CallHistory />}
          {activeTab === 'contacts' && <Contacts />}
          {activeTab === 'messages' && <div className="h-full flex items-center justify-center text-gray-400">Messages coming soon...</div>}
          {activeTab === 'settings' && <Settings />}
        </div>
      </div>

      {/* Right Persistent Area (Optional - you can keep small info here) */}
      <div className="flex-1 flex flex-col bg-[#0F1322] border-l border-gray-800">
        <div className="h-16 border-b border-gray-800 bg-[#161B28] flex items-center px-8">
          {/* <h2 className="text-xl font-semibold">Quick Dial</h2> */}
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Click <strong className="text-emerald-400 mx-1">+ New Call</strong> to open dialer
        </div>
      </div>

      {/* Dialer Popup Modal */}
      {showDialerModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#161B28] border border-gray-700 rounded-3xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-700 px-6 py-4">
              <h3 className="text-xl font-semibold">New Call</h3>
              <button 
                onClick={() => setShowDialerModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <Dialer selectedPhoneNumber={selectedPhoneNumber} />
            </div>
          </div>
        </div>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1C2333] border border-gray-700 rounded-3xl p-8 max-w-sm w-full mx-4 text-center">
            <h3 className="text-2xl font-semibold mb-4">Logout?</h3>
            <p className="text-gray-400 mb-8">Are you sure you want to logout from VoIP Pro?</p>
            <div className="flex gap-4">
              <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-2xl text-white font-medium transition">
                Cancel
              </button>
              <button onClick={handleLogout} className="flex-1 py-4 bg-red-600 hover:bg-red-700 rounded-2xl text-white font-medium transition">
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;