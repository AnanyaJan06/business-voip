import { useCallback, useState, useEffect } from 'react';
import Dialer from './components/Dialer.jsx';
import CallHistory from './components/CallHistory.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import Contacts from './components/Contacts.jsx';
import ConversationDetails from './components/ConversationDetails.jsx';
import Messages from './components/Messages.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import './App.css';

function NavIcon({ type }) {
  const common = {
    className: 'h-5 w-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  };

  const icons = {
    history: (
      <svg {...common}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.61a2 2 0 0 1-.45 2.11L8 9.72" />
      </svg>
    ),
    contacts: (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    messages: (
      <svg {...common}>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      </svg>
    ),
    settings: (
      <svg {...common}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    plus: (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </svg>
    ),
    sun: (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    ),
    moon: (
      <svg {...common}>
        <path d="M12 3a6 6 0 0 0 9 7.4A9 9 0 1 1 12 3Z" />
      </svg>
    )
  };

  return icons[type];
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('history');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
  const [selectedMessageNumber, setSelectedMessageNumber] = useState('');
  const [conversationNumber, setConversationNumber] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'night');
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
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

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

  const toggleTheme = () => {
    setTheme((current) => current === 'night' ? 'day' : 'night');
  };

  if (!token) return <Login />;

  return (
    <div className="app-shell flex h-screen flex-col bg-[#0A0C14] text-white overflow-hidden md:flex-row">
      {/* Sidebar */}
      <div className="shrink-0 bg-[#11151F] border-b border-gray-800 flex flex-col md:w-60 md:border-b-0 md:border-r">
        <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-800 md:px-5 md:py-4">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-400 rounded-xl flex items-center justify-center text-white shadow-lg">
            <NavIcon type="history" />
          </div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">VoIP Pro</h1>
        </div>

        <nav className="flex gap-2 overflow-x-auto p-3 no-scrollbar md:flex-1 md:flex-col md:gap-1 md:overflow-visible md:p-3">
          {[
            { id: 'history', label: 'Calls' },
            { id: 'contacts', label: 'Contacts' },
            { id: 'messages', label: 'Messages' },
            { id: 'settings', label: 'Settings' },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex shrink-0 items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium transition-all md:px-4 md:py-3
                ${activeTab === item.id ? 'bg-gray-800 text-white' : 'hover:bg-gray-800 text-gray-300'}`}
            >
              <span className="w-5 text-current"><NavIcon type={item.id} /></span>
              {item.label}
            </div>
          ))}

          {/* + New Call Button */}
          <div
            onClick={openNewCall}
            className="flex shrink-0 items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg md:mt-4 md:px-4 md:py-3"
          >
            <span className="w-5"><NavIcon type="plus" /></span>
            New Call
          </div>
        </nav>

        <div className="hidden p-3 border-t border-gray-800 md:block">
          <button
            type="button"
            onClick={toggleTheme}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
            title={theme === 'night' ? 'Switch to day mode' : 'Switch to night mode'}
          >
            <span className="w-5"><NavIcon type={theme === 'night' ? 'sun' : 'moon'} /></span>
            {theme === 'night' ? 'Day' : 'Night'}
          </button>
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
            type="button"
            onClick={toggleTheme}
            className="rounded-lg px-2 py-1.5 text-gray-300 hover:bg-gray-800 md:hidden"
            title={theme === 'night' ? 'Switch to day mode' : 'Switch to night mode'}
          >
            <span className="block w-5"><NavIcon type={theme === 'night' ? 'sun' : 'moon'} /></span>
          </button>
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

      <ConfirmModal
        open={showLogoutModal}
        title="Logout?"
        message="Are you sure you want to logout from VoIP Pro?"
        confirmText="Yes, Logout"
        variant="danger"
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}

export default App;
