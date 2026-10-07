import { useCallback, useRef, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import {
  Phone,
  Users,
  MessageSquare,
  CalendarCheck,
  LayoutDashboard,
  Settings as SettingsIcon,
  Plus,
  Sun,
  Moon,
  X,
  Minus,
  MessageCircle,
  ArrowLeft
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
import { showErrorToast, showIncomingSmsToast, showTeamMessageToast } from './utils/toast.js';
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
  const [smsWidgetThreads, setSmsWidgetThreads] = useState([]);
  const [smsWidgetOpen, setSmsWidgetOpen] = useState(false);
  const [smsWidgetPhone, setSmsWidgetPhone] = useState('');
  const smsWidgetBoundaryRef = useRef(null);
  const smsWidgetDragControls = useDragControls();
  const smsWidgetPointerStartRef = useRef(null);
  const smsWidgetDraggedRef = useRef(false);
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
  const pendingFollowUpSoundRef = useRef(false);
  const pendingIncomingSmsSoundRef = useRef(false);
  const dueFollowUpIdsRef = useRef(new Set());
  const isAdmin = currentUser?.role === 'admin';
  const prefersReducedMotion = useReducedMotion();
  const rightPanelKey = activeTab === 'history'
    ? showCallHistoryConversation
      ? `history-conversation-${conversationNumber}`
      : `history-call-${selectedCallLog?._id || selectedCallLog?.callSid || 'empty'}`
    : activeTab === 'team'
      ? `team-${getUserId(selectedTeamUser) || 'empty'}`
      : `${activeTab}-conversation-${conversationNumber || 'empty'}`;
  const smsWidgetContactName = smsWidgetPhone
    ? contactsList.find((contact) => normalizePhone(contact.phone) === normalizePhone(smsWidgetPhone))?.name
    : '';

  const playFollowUpAlertSound = useCallback(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext || audioContext.state !== 'running') {
      pendingFollowUpSoundRef.current = true;
      return;
    }

    pendingFollowUpSoundRef.current = false;

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

  const playIncomingSmsAlertSound = useCallback(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext || audioContext.state !== 'running') {
      pendingIncomingSmsSoundRef.current = true;
      return;
    }

    pendingIncomingSmsSoundRef.current = false;
    const startAt = audioContext.currentTime;
    [880, 1174.66].forEach((frequency, index) => {
      const noteStart = startAt + index * 0.11;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.045, noteStart + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.16);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.17);
    });
  }, []);

  const unlockAlertAudio = useCallback(() => {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextConstructor();
      }

      const audioContext = audioContextRef.current;
      const resumeAudio = audioContext.state === 'suspended'
        ? audioContext.resume()
        : Promise.resolve();

      resumeAudio
        .then(() => {
          if (pendingFollowUpSoundRef.current && audioContext.state === 'running') {
            playFollowUpAlertSound();
          }
          if (pendingIncomingSmsSoundRef.current && audioContext.state === 'running') {
            playIncomingSmsAlertSound();
          }
        })
        .catch(() => {});
    } catch (error) {
      console.info('Follow-up alert audio is unavailable:', error);
    }
  }, [playFollowUpAlertSound, playIncomingSmsAlertSound]);

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
      if (deviceStatus.isCalling) {
        showErrorToast('You are already on an active call.');
        setShowDialerModal(true);
        window.dispatchEvent(new Event('restoreDialer'));
        return;
      }
      setSelectedPhoneNumber(phoneNumber);
      setShowDialerModal(true);
      window.dispatchEvent(new Event('restoreDialer'));
    };
    window.addEventListener('callContact', handleCallContact);
    return () => window.removeEventListener('callContact', handleCallContact);
  }, [deviceStatus.isCalling]);

  useEffect(() => {
    const handlePasteNumberOnDialer = (event) => {
      const { phoneNumber } = event.detail || {};
      if (!phoneNumber) return;

      if (deviceStatus.isCalling) {
        showErrorToast('You are already on an active call.');
        setShowDialerModal(true);
        window.dispatchEvent(new Event('restoreDialer'));
        return;
      }

      setSelectedPhoneNumber(phoneNumber);
      setShowDialerModal(true);
      window.dispatchEvent(new Event('restoreDialer'));
    };

    window.addEventListener('pasteNumberOnDialer', handlePasteNumberOnDialer);
    return () => window.removeEventListener('pasteNumberOnDialer', handlePasteNumberOnDialer);
  }, [deviceStatus.isCalling]);

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
        playFollowUpAlertSound();
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

    const fetchContacts = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/contacts`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setContactsList(data);
          }
        }
      } catch (err) {
        console.error('Failed to pre-fetch contacts:', err);
      }
    };

    fetchContacts();
    window.addEventListener('refreshContacts', fetchContacts);
    return () => window.removeEventListener('refreshContacts', fetchContacts);
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

      playIncomingSmsAlertSound();

      setSmsWidgetThreads((threads) => {
        const phone = message.from || '';
        const key = normalizePhone(phone) || phone;
        const existing = threads.find((thread) => (normalizePhone(thread.phoneNumber) || thread.phoneNumber) === key);
        if (existing) {
          return threads.map((thread) => (thread === existing
            ? { ...thread, body: message.body || '', unread: thread.unread + 1 }
            : thread));
        }
        return [...threads, { phoneNumber: phone, body: message.body || '', unread: 1 }];
      });

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
  }, [openTab, playIncomingSmsAlertSound, refreshUnreadTeamMessages, token]);

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

    const handleSmsThreadRead = (event) => {
      const phoneNumber = event.detail?.phoneNumber;
      const threadKey = normalizePhone(phoneNumber) || phoneNumber;
      if (!threadKey) return;

      const readThread = smsWidgetThreads.find((thread) => (
        (normalizePhone(thread.phoneNumber) || thread.phoneNumber) === threadKey
      ));
      if (activeTabRef.current !== 'messages' && readThread?.unread) {
        setUnreadMessages((count) => Math.max(0, count - readThread.unread));
      }

      const userId = getUserId(currentUserRef.current);
      if (userId) {
        try {
          const unreadKey = getUnreadSmsThreadsKey(userId);
          const unreadThreads = JSON.parse(localStorage.getItem(unreadKey) || '[]');
          localStorage.setItem(unreadKey, JSON.stringify(unreadThreads.filter((key) => key !== threadKey)));
        } catch {
          localStorage.setItem(getUnreadSmsThreadsKey(userId), '[]');
        }
      }

      setSmsWidgetThreads((threads) => threads.map((thread) => (
        (normalizePhone(thread.phoneNumber) || thread.phoneNumber) === threadKey
          ? { ...thread, unread: 0 }
          : thread
      )));
    };

    window.addEventListener('openConversation', handleOpenConversation);
    window.addEventListener('sms-thread-read', handleSmsThreadRead);
    return () => {
      window.removeEventListener('openConversation', handleOpenConversation);
      window.removeEventListener('sms-thread-read', handleSmsThreadRead);
    };
  }, [smsWidgetThreads]);

  const clearSelectedMessageNumber = useCallback(() => {
    setSelectedMessageNumber('');
  }, []);

  const openNewCall = () => {
    if (deviceStatus.isCalling) {
      setShowDialerModal(true);
      window.dispatchEvent(new Event('restoreDialer'));
      return;
    }
    setSelectedPhoneNumber('');
    setShowDialerModal(true);
    window.dispatchEvent(new Event('restoreDialer'));
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
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={rightPanelKey}
            initial={prefersReducedMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: prefersReducedMotion ? 0 : -8 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: 'easeOut' }}
            className="h-full min-h-0 flex flex-col"
          >
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
              <ConversationDetails
                phoneNumber={conversationNumber}
                onClose={() => {
                  setShowCallHistoryConversation(false);
                  setConversationNumber('');
                }}
              />
            ) : activeTab === 'history' ? (
              <CallDetails
                call={selectedCallLog}
                contacts={contactsList}
                allLogs={callHistoryLogs}
                onSelectCall={setSelectedCallLog}
                onClose={() => setSelectedCallLog(null)}
              />
            ) : (
              <ConversationDetails
                phoneNumber={conversationNumber}
                onClose={() => setConversationNumber('')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Dialer
        selectedPhoneNumber={selectedPhoneNumber}
        isOpen={showDialerModal}
        onClose={() => setShowDialerModal(false)}
        currentUser={currentUser}
        onDeviceStatusChange={handleDeviceStatusChange}
        contacts={contactsList}
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

      <div ref={smsWidgetBoundaryRef} className="pointer-events-none fixed inset-0 z-[80]">
        <AnimatePresence>
          {smsWidgetThreads.length > 0 && (
            <motion.div
              key="incoming-sms-widget"
              drag
              dragListener={false}
              dragControls={smsWidgetDragControls}
              dragConstraints={smsWidgetBoundaryRef}
              dragMomentum={false}
              dragElastic={0}
              onPointerDown={(event) => {
                smsWidgetPointerStartRef.current = { x: event.clientX, y: event.clientY };
                smsWidgetDraggedRef.current = false;
              }}
              onPointerMove={(event) => {
                const start = smsWidgetPointerStartRef.current;
                if (start && (Math.abs(event.clientX - start.x) > 5 || Math.abs(event.clientY - start.y) > 5)) {
                  smsWidgetDraggedRef.current = true;
                }
              }}
              onPointerUp={() => {
                window.setTimeout(() => { smsWidgetPointerStartRef.current = null; }, 0);
              }}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
              className={`pointer-events-auto absolute bottom-5 right-5 touch-none ${smsWidgetOpen ? 'h-[min(620px,calc(100vh-2.5rem))] w-[min(390px,calc(100vw-2.5rem))]' : ''}`}
            >
              {smsWidgetOpen ? (
                <section className="sms-widget-panel flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-700 bg-[#0F1322] shadow-2xl">
                  <header onPointerDown={(event) => smsWidgetDragControls.start(event)} className="sms-widget-header flex shrink-0 cursor-grab touch-none items-center justify-between gap-3 border-b border-gray-700 bg-[#1C2333] px-3 py-2.5 active:cursor-grabbing">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{smsWidgetPhone ? (smsWidgetContactName || smsWidgetPhone) : 'Messages'}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {smsWidgetPhone && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setSmsWidgetPhone('')} className="rounded-lg p-2 text-gray-300 hover:bg-gray-700 hover:text-white" aria-label="Back to messages" title="Back"><ArrowLeft className="h-4 w-4" /></button>}
                      <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setSmsWidgetOpen(false)} className="rounded-lg p-2 text-gray-300 hover:bg-gray-700 hover:text-white" aria-label="Minimize conversation" title="Minimize"><Minus className="h-4 w-4" /></button>
                      <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setSmsWidgetOpen(false); setSmsWidgetThreads([]); setSmsWidgetPhone(''); }} className="rounded-lg p-2 text-gray-300 hover:bg-red-500/20 hover:text-red-300" aria-label="Hide message widget" title="Hide"><X className="h-4 w-4" /></button>
                      {smsWidgetPhone && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => { if (deviceStatus.isCalling) { showErrorToast('You are already on an active call.'); setShowDialerModal(true); window.dispatchEvent(new Event('restoreDialer')); return; } setSelectedPhoneNumber(smsWidgetPhone); setShowDialerModal(true); window.dispatchEvent(new Event('restoreDialer')); }} className="rounded-lg p-2 text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-200" aria-label="Call contact" title="Call"><Phone className="h-4 w-4" /></button>}
                    </div>
                  </header>
                  {smsWidgetPhone ? (
                    <div className="min-h-0 flex-1">
                      <ConversationDetails key={smsWidgetPhone} phoneNumber={smsWidgetPhone} hideHeader />
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                      {smsWidgetThreads.slice().reverse().map((thread) => (
                        <button key={normalizePhone(thread.phoneNumber) || thread.phoneNumber} type="button" onClick={() => { setSmsWidgetPhone(thread.phoneNumber); window.dispatchEvent(new CustomEvent('sms-thread-read', { detail: { phoneNumber: thread.phoneNumber } })); }} className="sms-widget-thread mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5">
                          <span className="sms-widget-avatar grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-500 text-white"><MessageCircle className="h-5 w-5" /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white">{thread.phoneNumber}</span><span className="block truncate text-xs text-gray-400">{thread.body || 'New message'}</span></span>
                          {thread.unread > 0 && <span className="sms-widget-unread grid h-5 min-w-5 place-items-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white">{thread.unread > 99 ? '99+' : thread.unread}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              ) : (
                <div onPointerDown={(event) => smsWidgetDragControls.start(event)} className="relative touch-none">
                  <button
                    type="button"
                    onClick={() => {
                      if (smsWidgetDraggedRef.current) { smsWidgetDraggedRef.current = false; return; }
                      setSmsWidgetPhone('');
                      setSmsWidgetOpen(true);
                    }}
                    className="sms-widget-bubble grid h-14 w-14 place-items-center rounded-full border border-sky-200/25 bg-gradient-to-br from-sky-400/20 via-indigo-400/15 to-cyan-300/20 text-sky-200 shadow-[0_8px_32px_rgba(14,165,233,0.28)] backdrop-blur-xl transition duration-200 hover:scale-105 hover:border-sky-200/45 hover:from-sky-400/30 hover:to-cyan-300/30"
                    aria-label="Open incoming SMS messages"
                  >
                    <MessageCircle className="h-6 w-6" />
                  </button>
                  {smsWidgetThreads.reduce((count, thread) => count + thread.unread, 0) > 0 && <span className="sms-widget-badge pointer-events-none absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{smsWidgetThreads.reduce((count, thread) => count + thread.unread, 0) > 99 ? '99+' : smsWidgetThreads.reduce((count, thread) => count + thread.unread, 0)}</span>}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AppToaster />
    </div>
  );
}

export default App;
