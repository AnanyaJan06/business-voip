import { useCallback, useRef, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Phone,
  Users,
  MessageSquare,
  CalendarCheck,
  LayoutDashboard,
  Settings as SettingsIcon,
  Plus,
  Sun,
  Moon
} from 'lucide-react';
import Dialer, { DEVICE_STATES, PhoneServiceAlert } from './components/Dialer.jsx';
import CallHistory from './components/CallHistory.jsx';
import CallDetails from './components/CallDetails.jsx';
import Contacts from './components/Contacts.jsx';
import ConversationDetails from './components/ConversationDetails.jsx';
import Messages from './components/Messages.jsx';
import InternalMessages, { InternalMessageDetails } from './components/InternalMessages.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import FollowUps from './components/FollowUps.jsx';
import AppToaster from './components/ui/AppToaster.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import { confirmAction } from './utils/confirmDialog.js';
import { showIncomingSmsToast, showTeamMessageToast } from './utils/toast.js';
import './App.css';

const BACKEND_URL = 'https://business-voip.onrender.com';

const getUserId = (user) => String(user?.id || user?._id || '');
const getUnreadMessagesKey = (userId) => `unreadMessages:${userId}`;
const getUnreadSmsThreadsKey = (userId) => `unreadSmsThreads:${userId}`;
const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

const readJsonResponse = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
};

function NavIcon({ type }) {
  const icons = {
    history: Phone,
    contacts: Users,
    messages: MessageSquare,
    team: Users,
    followups: CalendarCheck,
    admin: LayoutDashboard,
    settings: SettingsIcon,
    plus: Plus,
    sun: Sun,
    moon: Moon
  };

  const Icon = icons[type];
  return Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('history');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
  const [selectedMessageNumber, setSelectedMessageNumber] = useState('');
  const [selectedTeamUser, setSelectedTeamUser] = useState(null);
  const [conversationNumber, setConversationNumber] = useState('');
  const [selectedCallLog, setSelectedCallLog] = useState(null);
  const [showCallHistoryConversation, setShowCallHistoryConversation] = useState(false);
  const [callHistoryLogs, setCallHistoryLogs] = useState([]);
  const [contactsList, setContactsList] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'night');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadTeamMessages, setUnreadTeamMessages] = useState(0);
  const [dueFollowUps, setDueFollowUps] = useState(0);
  const [followUpToast, setFollowUpToast] = useState(null);
  const [showDialerModal, setShowDialerModal] = useState(false);   // ← New state
  const [currentUser, setCurrentUser] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState({
    deviceState: DEVICE_STATES.INITIALIZING,
    deviceError: '',
    retryDeviceRegistration: () => {},
    isCalling: false,
    incomingCall: false,
  });

  const handleDeviceStatusChange = useCallback((status) => {
    setDeviceStatus((prev) => {
      if (
        prev.deviceState === status.deviceState &&
        prev.deviceError === status.deviceError &&
        prev.isCalling === status.isCalling &&
        prev.incomingCall === status.incomingCall &&
        prev.retryDeviceRegistration === status.retryDeviceRegistration
      ) {
        return prev;
      }
      return status;
    });
  }, []);
  const activeTabRef = useRef(activeTab);
  const currentUserRef = useRef(currentUser);
  const selectedTeamUserRef = useRef(selectedTeamUser);
  const followUpToastTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const dueFollowUpIdsRef = useRef(new Set());
  const isAdmin = currentUser?.role === 'admin';
  const prefersReducedMotion = useReducedMotion();

  const unlockAlertAudio = useCallback(() => {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextConstructor();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    } catch (error) {
      console.info('Message alert audio is unavailable:', error);
    }
  }, []);

  const playFollowUpAlertSound = useCallback(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext || audioContext.state !== 'running') return;

    const startAt = audioContext.currentTime;
    [659.25, 783.99].forEach((frequency, index) => {
      const noteStart = startAt + index * 0.14;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.055, noteStart + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.19);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.2);
    });
  }, []);

  useEffect(() => {
    document.addEventListener('pointerdown', unlockAlertAudio);
    document.addEventListener('keydown', unlockAlertAudio);
    return () => {
      document.removeEventListener('pointerdown', unlockAlertAudio);
      document.removeEventListener('keydown', unlockAlertAudio);
    };
  }, [unlockAlertAudio]);

  const openTab = useCallback((tabId) => {
    setActiveTab(tabId);
    setShowCallHistoryConversation(false);
    if (tabId !== 'team') {
      setSelectedTeamUser(null);
    }
    if (tabId !== 'history') {
      setSelectedCallLog(null);
    }
    if (tabId === 'messages') {
      setUnreadMessages(0);
    }
    if (tabId === 'team') {
      setUnreadTeamMessages(0);
      window.dispatchEvent(new Event('refreshInternalMessages'));
    }
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

  useEffect(() => {
    const handlePasteNumberOnDialer = (event) => {
      const { phoneNumber } = event.detail || {};
      if (!phoneNumber) return;

      setSelectedPhoneNumber(phoneNumber);
      setShowDialerModal(true);
    };

    window.addEventListener('pasteNumberOnDialer', handlePasteNumberOnDialer);
    return () => window.removeEventListener('pasteNumberOnDialer', handlePasteNumberOnDialer);
  }, []);

  useEffect(() => {
    const handleMessageContact = (event) => {
      const { phoneNumber } = event.detail;
      setSelectedMessageNumber(phoneNumber);
      setConversationNumber(phoneNumber);
      openTab('messages');
    };

    window.addEventListener('messageContact', handleMessageContact);
    return () => window.removeEventListener('messageContact', handleMessageContact);
  }, [openTab]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    selectedTeamUserRef.current = selectedTeamUser;
  }, [selectedTeamUser]);

  useEffect(() => {
    const userId = getUserId(currentUser);
    if (!userId) {
      setUnreadMessages(0);
      return;
    }

    setUnreadMessages(Number(localStorage.getItem(getUnreadMessagesKey(userId))) || 0);
  }, [currentUser]);

  useEffect(() => {
    const userId = getUserId(currentUser);
    if (!userId) return;

    localStorage.setItem(getUnreadMessagesKey(userId), String(unreadMessages));
  }, [currentUser, unreadMessages]);

  const refreshUnreadTeamMessages = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/internal-messages/unread-count`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await readJsonResponse(res);

      if (res.ok) {
        setUnreadTeamMessages(Number(data.count) || 0);
      }
    } catch (error) {
      console.error('Failed to refresh team message count:', error);
    }
  }, [token]);

  const refreshDueFollowUps = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/followups`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await readJsonResponse(res);

      if (!res.ok || !Array.isArray(data)) return;

      const dueItems = data.filter((item) => (
        !item.completed && new Date(item.followUpDate) <= new Date()
      ));

      setDueFollowUps(dueItems.length);

      const dueItemsWithIds = dueItems.map((item) => ({
        item,
        id: String(item._id || item.id || `${item.name}:${item.followUpDate}`)
      }));
      const newlyDueItem = dueItemsWithIds.find(({ id }) => !dueFollowUpIdsRef.current.has(id));
      dueFollowUpIdsRef.current = new Set(dueItemsWithIds.map(({ id }) => id));

      if (dueItems.length > 0 && activeTabRef.current !== 'followups') {
        setFollowUpToast(newlyDueItem?.item || dueItems[0]);
        if (newlyDueItem) playFollowUpAlertSound();
        window.clearTimeout(followUpToastTimerRef.current);
        followUpToastTimerRef.current = window.setTimeout(() => {
          setFollowUpToast(null);
        }, 7000);
      }
    } catch (error) {
      console.error('Failed to refresh follow-up reminders:', error);
    }
  }, [playFollowUpAlertSound, token]);

  useEffect(() => {
    if (!token) return undefined;

    const initialRefresh = window.setTimeout(refreshDueFollowUps, 0);
    const interval = window.setInterval(refreshDueFollowUps, 60000);
    window.addEventListener('refreshFollowUps', refreshDueFollowUps);

    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      window.clearTimeout(followUpToastTimerRef.current);
      window.removeEventListener('refreshFollowUps', refreshDueFollowUps);
    };
  }, [refreshDueFollowUps, token]);

  useEffect(() => {
    if (!token) return undefined;

    const fetchCurrentUser = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const data = await res.json();

        if (res.ok) {
          setCurrentUser(data);
        }
      } catch (error) {
        console.error('Failed to load current user:', error);
      }
    };

    fetchCurrentUser();
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;

    const unreadRefreshTimer = window.setTimeout(refreshUnreadTeamMessages, 0);

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('incoming-message', (message) => {
      const assignedRecipients = Array.isArray(message.assignedTo)
        ? message.assignedTo.map((value) => String(value))
        : [String(message.assignedTo || '')].filter(Boolean);
      const currentUserId = getUserId(currentUserRef.current);

      if (!assignedRecipients.includes(currentUserId)) return;

      const threadKey = normalizePhone(message.from) || message.from;
      if (threadKey && activeTabRef.current !== 'messages') {
        const unreadKey = getUnreadSmsThreadsKey(currentUserId);
        const unreadThreads = JSON.parse(localStorage.getItem(unreadKey) || '[]');
        localStorage.setItem(unreadKey, JSON.stringify([...new Set([...unreadThreads, threadKey])]));
      }

      window.dispatchEvent(new CustomEvent('refreshMessages', {
        detail: { message }
      }));

      if (activeTabRef.current !== 'messages') {
        setUnreadMessages((count) => count + 1);
      }

      showIncomingSmsToast({
        from: message.from,
        body: message.body,
        onClick: () => {
          setSelectedMessageNumber(message.from);
          setConversationNumber(message.from);
          openTab('messages');
        }
      });
    });

    socket.on('call-transcription-updated', () => {
      window.dispatchEvent(new Event('refreshCallHistory'));
    });

    socket.on('refresh-call-history', () => {
      window.dispatchEvent(new Event('refreshCallHistory'));
    });

    socket.on('call-answered-by-teammate', (payload) => {
      window.dispatchEvent(new CustomEvent('callAnsweredByTeammate', {
        detail: payload
      }));
      window.dispatchEvent(new Event('refreshCallHistory'));
    });

    socket.on('message-status-updated', () => {
      window.dispatchEvent(new Event('refreshMessages'));
    });

    socket.on('internal-message-created', (message) => {
      window.dispatchEvent(new CustomEvent('refreshInternalMessages', {
        detail: message
      }));
      const user = currentUserRef.current;
      const currentUserId = getUserId(user);
      const senderId = getUserId(message.sender);
      const recipientId = getUserId(message.recipient);

      if (recipientId === currentUserId) {
        refreshUnreadTeamMessages();

        const selectedTeamUserId = getUserId(selectedTeamUserRef.current);
        const isOpenConversation = activeTabRef.current === 'team' && selectedTeamUserId === senderId;

        if (!isOpenConversation) {
          showTeamMessageToast({
            senderName: message.sender?.name,
            onClick: () => {
              setSelectedTeamUser(message.sender);
              openTab('team');
            }
          });
        }
      }
    });

    return () => {
      window.clearTimeout(unreadRefreshTimer);
      socket.disconnect();
    };
  }, [openTab, refreshUnreadTeamMessages, token]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleOpenConversation = (event) => {
      const { phoneNumber } = event.detail;
      setConversationNumber(phoneNumber);
      setShowCallHistoryConversation(activeTabRef.current === 'history');
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

  const handleLogout = async () => {
    const currentToken = localStorage.getItem('token');

    if (currentToken) {
      try {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`
          }
        });
      } catch (error) {
        console.error('Failed to record logout:', error);
      }
    }

    localStorage.removeItem('token');
    setToken(null);
    setSelectedPhoneNumber('');
    setSelectedMessageNumber('');
    setSelectedTeamUser(null);
    setSelectedCallLog(null);
    setConversationNumber('');
    setUnreadMessages(0);
    setUnreadTeamMessages(0);
    setDueFollowUps(0);
    setFollowUpToast(null);
    setCurrentUser(null);
  };

  const confirmLogout = () => {
    confirmAction({
      title: 'Logout?',
      text: 'Are you sure you want to logout?',
      confirmButtonText: 'Logout',
      icon: 'warning',
      confirmButtonColor: '#DC2626',
      onConfirm: handleLogout
    });
  };

  const toggleTheme = () => {
    setTheme((current) => current === 'night' ? 'day' : 'night');
  };

  if (!token) {
    return (
      <>
        <Login />
        <AppToaster />
      </>
    );
  }

  return (
    <div className="app-shell flex h-screen flex-col bg-[#0A0C14] text-white overflow-hidden md:flex-row">
      {/* Sidebar */}
      <div className="shrink-0 bg-[#11151F] border-b border-gray-800 flex flex-col md:w-60 md:border-b-0 md:border-r">
        <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-800 md:px-5 md:py-4">
          <img src="/dialio-logo.png" alt="Dialio" className="h-9 w-9 rounded-xl object-contain" />
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Dialio</h1>
        </div>

        <nav className="flex gap-2 overflow-x-auto p-3 no-scrollbar md:flex-1 md:flex-col md:gap-1 md:overflow-y-auto md:overflow-x-hidden md:p-3 thin-scrollbar">
          {[
            ...(isAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
            { id: 'history', label: 'Calls' },
            { id: 'contacts', label: 'Contacts' },
            { id: 'messages', label: 'Messages' },
            { id: 'team', label: 'Team Chat' },
            { id: 'followups', label: 'Follow Ups' },
            { id: 'settings', label: 'Settings' },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => openTab(item.id)}
              className={`flex shrink-0 items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium transition-all md:px-4 md:py-3
                ${activeTab === item.id ? 'bg-gray-800 text-white' : 'hover:bg-gray-800 text-gray-300'}`}
            >
              <span className="w-5 text-current"><NavIcon type={item.id} /></span>
              <span>{item.label}</span>
              {item.id === 'messages' && unreadMessages > 0 && (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
              {item.id === 'team' && unreadTeamMessages > 0 && (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {unreadTeamMessages > 99 ? '99+' : unreadTeamMessages}
                </span>
              )}
              {item.id === 'followups' && dueFollowUps > 0 && (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {dueFollowUps > 99 ? '99+' : dueFollowUps}
                </span>
              )}
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

          {/* Phone Service Status Notice (Moved below New Call button) */}
          {!deviceStatus.isCalling && !deviceStatus.incomingCall && deviceStatus.deviceState && deviceStatus.deviceState !== DEVICE_STATES.READY && (
            <div className="hidden md:block md:mt-3">
              <PhoneServiceAlert
                deviceState={deviceStatus.deviceState}
                deviceError={deviceStatus.deviceError}
                onRetry={deviceStatus.retryDeviceRegistration}
              />
            </div>
          )}
        </nav>

        {/* Mobile Phone Service Status Notice */}
        {!deviceStatus.isCalling && !deviceStatus.incomingCall && deviceStatus.deviceState && deviceStatus.deviceState !== DEVICE_STATES.READY && (
          <div className="px-3 pb-3 md:hidden">
            <PhoneServiceAlert
              deviceState={deviceStatus.deviceState}
              deviceError={deviceStatus.deviceError}
              onRetry={deviceStatus.retryDeviceRegistration}
            />
          </div>
        )}

        <div className="hidden p-3 border-t border-gray-800 md:block">
          <div className="hidden md:block">
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
              onClick={confirmLogout}
              className="w-full py-2.5 text-sm text-red-400 hover:bg-red-950/30 rounded-xl transition font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Middle Panel */}
      <div className="min-h-0 flex-1 border-r border-gray-800 bg-[#161B28] flex flex-col md:w-[390px] md:flex-none xl:w-[410px]">
        <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-[#1C2333] md:h-14 md:px-5">
          <h2 className="text-base font-semibold md:text-lg">
            {activeTab === 'admin' && 'Admin Dashboard'}
            {activeTab === 'history' && 'Call History'}
            {activeTab === 'contacts' && 'Contacts'}
            {activeTab === 'messages' && 'Messages'}
            {activeTab === 'team' && 'Team Chat'}
            {activeTab === 'followups' && 'Follow Ups'}
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
            onClick={confirmLogout}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/30 md:hidden"
          >
            Logout
          </button>
        </div>

        <div className="flex-1 overflow-auto thin-scrollbar p-2 md:p-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -5 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
              className="min-h-full"
            >
              {activeTab === 'admin' && isAdmin && (
                <AdminDashboard showStats={false} showCreateUser={false} showUsers />
              )}
              {activeTab === 'history' && (
                <CallHistory
                  selectedCall={selectedCallLog}
                  onSelectCall={(call) => {
                    setSelectedCallLog(call);
                    setShowCallHistoryConversation(false);
                  }}
                  onLogsLoaded={setCallHistoryLogs}
                  onContactsLoaded={setContactsList}
                />
              )}
              {activeTab === 'contacts' && <Contacts />}
              {activeTab === 'messages' && (
                <Messages
                  selectedPhoneNumber={selectedMessageNumber}
                  onRecipientUsed={clearSelectedMessageNumber}
                  currentUser={currentUser}
                />
              )}
              {activeTab === 'team' && (
                <InternalMessages
                  currentUser={currentUser}
                  selectedUserId={getUserId(selectedTeamUser)}
                  onSelectUser={setSelectedTeamUser}
                  onReadMessages={refreshUnreadTeamMessages}
                />
              )}
              {activeTab === 'followups' && (
                <FollowUps onDueCountChange={setDueFollowUps} />
              )}
              {activeTab === 'settings' && <Settings />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right Persistent Area (Optional - you can keep small info here) */}
      <div className="hidden min-w-0 flex-1 flex-col border-l border-gray-800 bg-[#0F1322] lg:flex">
        {activeTab === 'admin' && isAdmin ? (
          <div className="h-full overflow-auto p-4 thin-scrollbar">
            <AdminDashboard showUsers={false} />
          </div>
        ) : activeTab === 'team' ? (
          <InternalMessageDetails
            currentUser={currentUser}
            selectedUser={selectedTeamUser}
            onReadMessages={refreshUnreadTeamMessages}
          />
        ) : activeTab === 'history' && showCallHistoryConversation ? (
          <div key={conversationNumber} className="conversation-panel-enter h-full min-h-0">
            <ConversationDetails
              phoneNumber={conversationNumber}
              onClose={() => {
                setShowCallHistoryConversation(false);
                setConversationNumber('');
              }}
            />
          </div>
        ) : activeTab === 'history' ? (
          <div key={selectedCallLog?._id || selectedCallLog?.callSid || 'call-details'} className="call-details-panel-enter h-full min-h-0">
            <CallDetails
              call={selectedCallLog}
              contacts={contactsList}
              allLogs={callHistoryLogs}
              onSelectCall={setSelectedCallLog}
              onClose={() => setSelectedCallLog(null)}
            />
          </div>
        ) : (
          <ConversationDetails
            phoneNumber={conversationNumber}
            onClose={() => setConversationNumber('')}
          />
        )}
      </div>

      <Dialer
        selectedPhoneNumber={selectedPhoneNumber}
        isOpen={showDialerModal}
        onClose={() => setShowDialerModal(false)}
        currentUser={currentUser}
        onDeviceStatusChange={handleDeviceStatusChange}
      />

      {followUpToast && (
        <button
          type="button"
          onClick={() => {
            openTab('followups');
            setFollowUpToast(null);
          }}
          className="fixed right-4 top-4 z-[70] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-amber-500/25 bg-[#151B28] p-4 text-left shadow-2xl transition hover:border-amber-400"
          aria-label={`Open due follow-up for ${followUpToast.name}`}
        >
          <span className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">Follow-up due</span>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">Due now</span>
          </span>
          <span className="block truncate text-xs text-gray-400">{followUpToast.name}</span>
          <span className="mt-2 line-clamp-2 block text-sm text-gray-300">{followUpToast.note}</span>
        </button>
      )}

      <AppToaster />
    </div>
  );
}

export default App;
