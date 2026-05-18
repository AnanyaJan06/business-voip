import { useCallback, useState, useEffect } from 'react';
import Dialer from './components/Dialer.jsx';
import CallHistory from './components/CallHistory.jsx';
import Contacts from './components/Contacts.jsx';
import ConversationDetails from './components/ConversationDetails.jsx';
import Messages from './components/Messages.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('history');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
  const [selectedMessageNumber, setSelectedMessageNumber] = useState('');
  const [conversationNumber, setConversationNumber] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDialerModal, setShowDialerModal] = useState(false);   // ← New state

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

  useEffect(() => {
    const handleMessageContact = (event) => {
      const { phoneNumber } = event.detail;
      setSelectedMessageNumber(phoneNumber);
      setActiveTab('messages');
    };

    window.addEventListener('messageContact', handleMessageContact);
    return () => window.removeEventListener('messageContact', handleMessageContact);
  }, []);

  useEffect(() => {
    const handleOpenConversation = (event) => {
      const { phoneNumber } = event.detail;
      setConversationNumber(phoneNumber);
    };

    window.addEventListener('openConversation', handleOpenConversation);
    return () => window.removeEventListener('openConversation', handleOpenConversation);
  }, []);

  const clearSelectedMessageNumber = useCallback(() => {
    setSelectedMessageNumber('');
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
    setSelectedMessageNumber('');
    setConversationNumber('');
  };

  if (!token) return <Login />;

  return (
    <div className="flex h-screen flex-col bg-[#0A0C14] text-white overflow-hidden md:flex-row">
      {/* Sidebar */}
      <div className="shrink-0 bg-[#11151F] border-b border-gray-800 flex flex-col md:w-60 md:border-b-0 md:border-r">
        <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-800 md:px-5 md:py-4">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-400 rounded-xl flex items-center justify-center text-2xl shadow-lg">
            📞
          </div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">VoIP Pro</h1>
        </div>

        <nav className="flex gap-2 overflow-x-auto p-3 no-scrollbar md:flex-1 md:flex-col md:gap-1 md:overflow-visible md:p-3">
          {[
            { id: 'history', label: 'Calls', icon: '📞' },
            { id: 'contacts', label: 'Contacts', icon: '👥' },
            { id: 'messages', label: 'Messages', icon: '✉️' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex shrink-0 items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium transition-all md:px-4 md:py-3
                ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-800 text-gray-300'}`}
            >
              <span className="text-lg w-5">{item.icon}</span>
              {item.label}
            </div>
          ))}

          {/* + New Call Button */}
          <div
            onClick={openNewCall}
            className="flex shrink-0 items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg md:mt-4 md:px-4 md:py-3"
          >
            <span className="text-lg w-5">+</span>
            New Call
          </div>
        </nav>

        <div className="hidden p-3 border-t border-gray-800 md:block">
          <button 
            onClick={() => setShowLogoutModal(true)}
            className="w-full py-2.5 text-sm text-red-400 hover:bg-red-950/30 rounded-xl transition font-medium"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Middle Panel */}
      <div className="min-h-0 flex-1 border-r border-gray-800 bg-[#161B28] flex flex-col md:w-[390px] md:flex-none xl:w-[410px]">
        <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-[#1C2333] md:h-14 md:px-5">
          <h2 className="text-base font-semibold md:text-lg">
            {activeTab === 'history' && 'Call History'}
            {activeTab === 'contacts' && 'Contacts'}
            {activeTab === 'messages' && 'Messages'}
            {activeTab === 'settings' && 'Settings'}
          </h2>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/30 md:hidden"
          >
            Logout
          </button>
        </div>

        <div className="flex-1 overflow-auto thin-scrollbar p-2 md:p-3">
          {activeTab === 'history' && <CallHistory />}
          {activeTab === 'contacts' && <Contacts />}
          {activeTab === 'messages' && (
            <Messages
              selectedPhoneNumber={selectedMessageNumber}
              onRecipientUsed={clearSelectedMessageNumber}
            />
          )}
          {activeTab === 'settings' && <Settings />}
        </div>
      </div>

      {/* Right Persistent Area (Optional - you can keep small info here) */}
      <div className="hidden min-w-0 flex-1 flex-col border-l border-gray-800 bg-[#0F1322] lg:flex">
        <ConversationDetails
          phoneNumber={conversationNumber}
          onClose={() => setConversationNumber('')}
        />
      </div>

      <Dialer
        selectedPhoneNumber={selectedPhoneNumber}
        isOpen={showDialerModal}
        onClose={() => setShowDialerModal(false)}
      />

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1C2333] border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 text-center">
            <h3 className="text-xl font-semibold mb-3">Logout?</h3>
            <p className="text-sm text-gray-400 mb-6">Are you sure you want to logout from VoIP Pro?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm text-white font-medium transition">
                Cancel
              </button>
              <button onClick={handleLogout} className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-sm text-white font-medium transition">
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
