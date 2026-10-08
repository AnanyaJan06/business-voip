import { useState, useEffect, useRef, useCallback } from 'react';
import { Device } from '@twilio/voice-sdk';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneIncoming,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Grid,
  Minimize2,
  Maximize2,
  Minus,
  X,
  GripHorizontal,
  Delete,
  User
} from 'lucide-react';
import { BACKEND_URL } from '../config/api.js';

export const DEVICE_STATES = {
  INITIALIZING: 'initializing',
  REGISTERING: 'registering',
  REFRESHING: 'refreshing',
  READY: 'ready',
  OFFLINE: 'offline',
  ERROR: 'error',
};

export function PhoneServiceAlert({ deviceState, deviceError, onRetry, className = '' }) {
  if (!deviceState || deviceState === DEVICE_STATES.READY) return null;

  const isErrorOrOffline = deviceState === DEVICE_STATES.ERROR || deviceState === DEVICE_STATES.OFFLINE;

  return (
    <div
      className={`w-full rounded-xl border p-2.5 shadow-lg transition-all ${isErrorOrOffline ? 'sidebar-status-error' : 'sidebar-status-info'} ${
        isErrorOrOffline
          ? 'border-amber-500/30 bg-[#1A1410]'
          : 'border-sky-500/25 bg-[#101A28]'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                isErrorOrOffline
                  ? 'bg-amber-400'
                  : 'bg-sky-400 animate-pulse'
              }`}
            />
            <p className="text-xs font-semibold text-white truncate">
              {isErrorOrOffline ? 'Not receiving calls' : 'Connecting phone service'}
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-gray-300 break-words">
            {deviceError || (
              deviceState === DEVICE_STATES.REFRESHING
                ? 'Refreshing connection so shared numbers keep ringing.'
                : 'Stay on this page to receive inbound calls on shared numbers.'
            )}
          </p>
        </div>
      </div>
      {isErrorOrOffline && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 w-full rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-[#1A1410] hover:bg-amber-400 transition"
        >
          Retry
        </button>
      )}
    </div>
  );
}

const fetchTwilioToken = async () => {
  const authToken = localStorage.getItem('token');
  if (!authToken) {
    throw new Error('Not signed in');
  }

  const res = await fetch(`${BACKEND_URL}/api/twilio/token`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const data = await res.json();

  if (!res.ok || !data.token) {
    throw new Error(data.message || 'Unable to get Twilio token');
  }

  return data.token;
};

const INCOMING_ALERT_TITLE = 'Incoming call';
const INCOMING_ALERT_BODY = 'Open Dialio to answer or reject.';

const canUseNotifications = () => (
  typeof window !== 'undefined'
  && window.isSecureContext
  && 'Notification' in window
);

const getIncomingCallerNumber = (conn) => {
  const customFrom = conn?.customParameters?.get?.('originalFrom');
  return customFrom || conn?.parameters?.originalFrom || conn?.parameters?.From || 'Unknown Number';
};

const getIncomingAllottedNumber = (conn) => {
  const customTo = conn?.customParameters?.get?.('originalTo');
  return customTo || conn?.parameters?.originalTo || conn?.parameters?.To || '';
};

const getParentCallSid = (conn) => {
  const customSid = conn?.customParameters?.get?.('parentCallSid');
  return customSid || conn?.parameters?.parentCallSid || conn?.parameters?.CallSid || '';
};

const getIncomingCallContext = (conn) => {
  const getParam = (name) => conn?.customParameters?.get?.(name) || conn?.parameters?.[name] || '';

  return {
    lastHandledBy: getParam('lastHandledBy'),
    lastHandledByName: getParam('lastHandledByName'),
    lastHandledAt: getParam('lastHandledAt'),
    lastCallType: getParam('lastCallType'),
    lastCallStatus: getParam('lastCallStatus')
  };
};

const getUserId = (user) => String(user?.id || user?._id || '');

const formatLastHandledAt = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const getDialableClipboardValue = (value) => String(value || '')
  .replace(/[^\d+*#]/g, '')
  .replace(/(?!^)\+/g, '');

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

const KEYPAD_BUTTONS = [
  { key: '1', sub: '' },
  { key: '2', sub: 'ABC' },
  { key: '3', sub: 'DEF' },
  { key: '4', sub: 'GHI' },
  { key: '5', sub: 'JKL' },
  { key: '6', sub: 'MNO' },
  { key: '7', sub: 'PQRS' },
  { key: '8', sub: 'TUV' },
  { key: '9', sub: 'WXYZ' },
  { key: '*', sub: '' },
  { key: '0', sub: '+' },
  { key: '#', sub: '' },
];

function Dialer({
  selectedPhoneNumber = '',
  isOpen = true,
  onClose,
  currentUser = null,
  onDeviceStatusChange,
  contacts = []
}) {
  const [phoneNumber, setPhoneNumber] = useState(selectedPhoneNumber);
  const [device, setDevice] = useState(null);
  const [connection, setConnection] = useState(null);
  const [callStatus, setCallStatus] = useState('Ready');
  const [deviceState, setDeviceState] = useState(DEVICE_STATES.INITIALIZING);
  const [deviceError, setDeviceError] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isIncomingMinimized, setIsIncomingMinimized] = useState(false);

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const activeCallRef = useRef(null);
  const currentUserRef = useRef(currentUser);
  const resolveInboundCallEndRef = useRef(async () => {});
  const incomingNotificationRef = useRef(null);
  const titleAlertRef = useRef(null);
  const originalTitleRef = useRef(typeof document !== 'undefined' ? document.title : '');
  const ringtoneAudioRef = useRef(null);
  const deviceRef = useRef(null);
  const tokenRefreshRef = useRef(null);
  const retryDeviceRegistrationRef = useRef(async () => {});

  const boundaryRef = useRef(null);
  const dragControls = useDragControls();
  const miniDragControls = useDragControls();
  const miniPointerStartRef = useRef(null);
  const miniDraggedRef = useRef(false);

  const isDeviceReady = deviceState === DEVICE_STATES.READY;

  const retryDeviceRegistration = useCallback(() => {
    retryDeviceRegistrationRef.current();
  }, []);

  useEffect(() => {
    onDeviceStatusChange?.({
      deviceState,
      deviceError,
      retryDeviceRegistration,
      isCalling,
      incomingCall: Boolean(incomingCall),
    });
  }, [deviceState, deviceError, isCalling, incomingCall, retryDeviceRegistration, onDeviceStatusChange]);

  const matchedContact = phoneNumber
    ? contacts.find((contact) => normalizePhone(contact.phone) === normalizePhone(phoneNumber))
    : null;

  const incomingContact = incomingCall?.from
    ? contacts.find((contact) => normalizePhone(contact.phone) === normalizePhone(incomingCall.from))
    : null;

  const formatIncomingAlertText = (from) => {
    if (incomingContact?.name) return `${incomingContact.name} (${from})`;
    return from || 'Unknown Number';
  };

  const stopIncomingAlerts = () => {
    incomingNotificationRef.current?.close?.();
    incomingNotificationRef.current = null;

    if (titleAlertRef.current) {
      window.clearInterval(titleAlertRef.current);
      titleAlertRef.current = null;
      document.title = originalTitleRef.current;
    }

    if (ringtoneAudioRef.current) {
      ringtoneAudioRef.current.pause();
      try {
        ringtoneAudioRef.current.currentTime = 0;
      } catch {
        // Ignored
      }
    }
  };

  const createRingtoneAudio = () => {
    if (ringtoneAudioRef.current) return ringtoneAudioRef.current;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;

    const audioContext = new AudioContextCtor();
    const soundDuration = 1.8;
    const sampleRate = audioContext.sampleRate;
    const frameCount = sampleRate * soundDuration;
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i += 1) {
      const time = i / sampleRate;
      const isTone = (time % 0.9) < 0.55;
      const tone = Math.sin(2 * Math.PI * 440 * time) + Math.sin(2 * Math.PI * 554.37 * time);
      channel[i] = isTone ? tone * 0.18 : 0;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const destination = audioContext.createMediaStreamDestination();
    source.connect(destination);
    source.start();

    const audio = new Audio();
    audio.srcObject = destination.stream;
    audio.loop = true;
    ringtoneAudioRef.current = audio;
    return audio;
  };

  const playIncomingRingtone = async () => {
    try {
      const audio = createRingtoneAudio();
      if (!audio) return;

      await audio.play();
    } catch (err) {
      console.info('Incoming call ringtone was blocked by the browser:', err);
    }
  };

  const requestNotificationPermission = async () => {
    if (!canUseNotifications() || Notification.permission !== 'default') return;

    try {
      await Notification.requestPermission();
    } catch (err) {
      console.info('Notification permission request failed:', err);
    }
  };

  const startTitleAlert = (from) => {
    if (titleAlertRef.current) return;

    let showAlert = true;
    const alertTitle = `${INCOMING_ALERT_TITLE}: ${formatIncomingAlertText(from)}`;
    originalTitleRef.current = document.title;
    document.title = alertTitle;

    titleAlertRef.current = window.setInterval(() => {
      document.title = showAlert ? alertTitle : originalTitleRef.current;
      showAlert = !showAlert;
    }, 1000);
  };

  const showNativeIncomingNotification = async (from) => {
    if (!canUseNotifications()) return;

    if (Notification.permission === 'default') {
      await requestNotificationPermission();
    }

    if (Notification.permission !== 'granted') return;

    incomingNotificationRef.current?.close?.();
    incomingNotificationRef.current = new Notification(INCOMING_ALERT_TITLE, {
      body: `${formatIncomingAlertText(from)}\n${INCOMING_ALERT_BODY}`,
      tag: 'dialio-incoming-call',
      requireInteraction: true
    });

    incomingNotificationRef.current.onclick = () => {
      window.focus();
      setIsIncomingMinimized(false);
      incomingNotificationRef.current?.close?.();
    };
  };

  const startIncomingAlerts = (from) => {
    startTitleAlert(from);
    playIncomingRingtone();

    if (navigator.vibrate) {
      navigator.vibrate([300, 120, 300, 120, 300]);
    }

    if (document.hidden || !document.hasFocus()) {
      showNativeIncomingNotification(from);
    }
  };

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // When opened or selectedPhoneNumber changes, unminimize and populate number
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
      if (selectedPhoneNumber) {
        setPhoneNumber(selectedPhoneNumber);
      }
    }
  }, [isOpen, selectedPhoneNumber]);

  // Listen for global restore event
  useEffect(() => {
    const handleRestore = () => {
      setIsMinimized(false);
    };
    window.addEventListener('restoreDialer', handleRestore);
    return () => window.removeEventListener('restoreDialer', handleRestore);
  }, []);

  useEffect(() => {
    const handleTeammateAnswered = (event) => {
      const {
        callSid,
        parentCallSid,
        answeredBy,
        answeredByName,
        assignedUserIds = []
      } = event.detail || {};
      const sessionCallSid = parentCallSid || callSid;
      const currentUserId = getUserId(currentUserRef.current);

      if (!sessionCallSid || !currentUserId) return;
      if (!assignedUserIds.map(String).includes(currentUserId)) return;
      if (String(answeredBy) === currentUserId) return;

      const currentCall = activeCallRef.current;
      if (!currentCall || currentCall.parentCallSid !== sessionCallSid || currentCall.accepted) return;

      activeCallRef.current = {
        ...currentCall,
        teammateAnswered: true,
        answeredBy,
        answeredByName,
        logged: true
      };

      stopIncomingAlerts();
      setIncomingCall(null);
      setIsIncomingMinimized(false);
      setConnection(null);
      resetCall();
    };

    window.addEventListener('callAnsweredByTeammate', handleTeammateAnswered);
    return () => window.removeEventListener('callAnsweredByTeammate', handleTeammateAnswered);
  }, []);

  useEffect(() => {
    const unlockAlerts = () => {
      requestNotificationPermission();
      createRingtoneAudio();
    };

    window.addEventListener('pointerdown', unlockAlerts, { once: true });
    window.addEventListener('keydown', unlockAlerts, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAlerts);
      window.removeEventListener('keydown', unlockAlerts);
      stopIncomingAlerts();
    };
  }, []);

  // Safe paste: do NOT hijack paste if user is typing in any input/textarea in the app
  useEffect(() => {
    const handlePaste = (event) => {
      if (!isOpen || isCalling || incomingCall || isMinimized) return;
      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if (isInput) return;

      const pastedNumber = getDialableClipboardValue(event.clipboardData?.getData('text'));
      if (!pastedNumber) return;

      event.preventDefault();
      setPhoneNumber(pastedNumber);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [incomingCall, isCalling, isMinimized, isOpen]);

  // Safe keyboard typing: do NOT hijack keystrokes if user is typing in any input/textarea in the app
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen || isCalling || incomingCall || isMinimized) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if (isInput) return;

      if (/^\d$/.test(event.key) || event.key === '*' || event.key === '#') {
        event.preventDefault();
        setPhoneNumber((current) => current + event.key);
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        setPhoneNumber((current) => current.slice(0, -1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [incomingCall, isCalling, isMinimized, isOpen]);

  // Duration Timer
  useEffect(() => {
    if (startTimeRef.current && isCalling) {
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isCalling, callStatus]);

  // Initialize Twilio Device
  useEffect(() => {
    let twilioDevice;
    let disposed = false;

    const refreshDeviceToken = async (activeDevice, { silent = false } = {}) => {
      if (!activeDevice || tokenRefreshRef.current) return false;

      tokenRefreshRef.current = true;
      if (!silent) {
        setDeviceState(DEVICE_STATES.REFRESHING);
        setDeviceError('');
      }

      try {
        const token = await fetchTwilioToken();
        activeDevice.updateToken(token);
        return true;
      } catch (err) {
        console.error('Twilio token refresh failed:', err);
        setDeviceState(DEVICE_STATES.ERROR);
        setDeviceError(err.message || 'Unable to refresh phone connection');
        return false;
      } finally {
        tokenRefreshRef.current = false;
      }
    };

    const retryDeviceRegistration = async () => {
      const activeDevice = deviceRef.current;
      if (!activeDevice) return;

      setDeviceState(DEVICE_STATES.REGISTERING);
      setDeviceError('');

      try {
        const token = await fetchTwilioToken();
        activeDevice.updateToken(token);
        await activeDevice.register();
      } catch (err) {
        console.error('Twilio device retry failed:', err);
        setDeviceState(DEVICE_STATES.OFFLINE);
        setDeviceError(err.message || 'Unable to connect phone service');
      }
    };

    retryDeviceRegistrationRef.current = retryDeviceRegistration;

    const handleVisibilityChange = () => {
      if (disposed || document.visibilityState !== 'visible' || !twilioDevice) return;
      if (twilioDevice.state === Device.State.Registered) return;

      retryDeviceRegistration();
    };

    const initDevice = async () => {
      setDeviceState(DEVICE_STATES.INITIALIZING);
      setDeviceError('');

      try {
        const token = await fetchTwilioToken();
        if (disposed) return;

        twilioDevice = new Device(token, {
          edge: ['singapore', 'tokyo'],
          logLevel: 'warn',
        });
        deviceRef.current = twilioDevice;

        twilioDevice.on('registering', () => {
          setDeviceState(DEVICE_STATES.REGISTERING);
        });

        twilioDevice.on('registered', () => {
          setDeviceState(DEVICE_STATES.READY);
          setDeviceError('');
          setCallStatus('Ready');
        });

        twilioDevice.on('unregistered', () => {
          setDeviceState(DEVICE_STATES.OFFLINE);
          setDeviceError('Phone service disconnected');
        });

        twilioDevice.on('tokenWillExpire', () => {
          refreshDeviceToken(twilioDevice);
        });

        // Listen for Incoming Calls
        twilioDevice.on('incoming', (conn) => {
          const from = getIncomingCallerNumber(conn);
          const localNumber = getIncomingAllottedNumber(conn);
          const parentCallSid = getParentCallSid(conn);
          const callerContext = getIncomingCallContext(conn);

          activeCallRef.current = {
            callType: 'inbound',
            phoneNumber: from,
            localNumber,
            callSid: parentCallSid,
            parentCallSid,
            accepted: false,
            logged: false
          };

          setIncomingCall({
            from,
            callSid: parentCallSid,
            ...callerContext
          });
          setIsIncomingMinimized(false);
          setConnection(conn);
          startIncomingAlerts(from);

          conn.on('cancel', () => resolveInboundCallEndRef.current());
          conn.on('disconnect', () => {
            if (activeCallRef.current?.accepted) {
              handleCallEnd(conn, {
                phoneNumber: from,
                localNumber,
                callType: 'inbound',
                status: 'completed'
              });
            } else {
              resolveInboundCallEndRef.current();
            }
          });
          conn.on('reject', () => {
            if (activeCallRef.current) {
              activeCallRef.current = {
                ...activeCallRef.current,
                rejected: true
              };
            }
          });
          conn.on('error', () => resolveInboundCallEndRef.current());
        });

        twilioDevice.on('error', (err) => {
          console.error('Twilio Device Error:', err);
          setDeviceState(DEVICE_STATES.ERROR);
          setDeviceError(err.message || 'Phone service error');
          setCallStatus('Device error');

          if (err.code === 20104 || err.code === 31205 || err.code === 31204) {
            refreshDeviceToken(twilioDevice).then((refreshed) => {
              if (refreshed && !disposed) {
                twilioDevice.register().catch(() => {});
              }
            });
          }
        });

        setDeviceState(DEVICE_STATES.REGISTERING);
        await twilioDevice.register();
        if (disposed) return;

        setDevice(twilioDevice);
      } catch (err) {
        console.error('Device Initialization Error:', err);
        setDeviceState(DEVICE_STATES.OFFLINE);
        setDeviceError(err.message || 'Unable to connect phone service');
        setCallStatus('Device offline');
      }
    };

    initDevice();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      deviceRef.current = null;
      if (twilioDevice) {
        twilioDevice.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInboundSession = async ({ callSid, phoneNumber: pNum, localNumber }, attempts = 3) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const params = new URLSearchParams();
        if (pNum) params.set('phoneNumber', pNum);
        if (localNumber) params.set('localNumber', localNumber);
        const query = params.toString();
        const res = await fetch(
          `${BACKEND_URL}/api/calls/session/${encodeURIComponent(callSid)}${query ? `?${query}` : ''}`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          }
        );

        if (res.ok) {
          const session = await res.json();
          if (session.status === 'answered' || attempt === attempts - 1) {
            return session;
          }
        }
      } catch (err) {
        console.error('Failed to fetch inbound session:', err);
      }

      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }

    return null;
  };

  const logCall = async ({ phoneNumber: pNum, localNumber, callType, duration: callDuration, status, callSid, answeredBy }) => {
    const currentCall = activeCallRef.current;
    if (currentCall?.callSid === callSid && currentCall.logged) return;

    if (currentCall?.callSid === callSid) {
      activeCallRef.current = { ...currentCall, logged: true };
    }

    try {
      await fetch(`${BACKEND_URL}/api/calls/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          phoneNumber: pNum,
          localNumber,
          callType,
          duration: callDuration,
          status,
          callSid,
          answeredBy
        })
      });

      window.dispatchEvent(new Event('refreshCallHistory'));
    } catch (err) {
      console.error(err);
    }
  };

  const clearIncomingCallState = () => {
    setIncomingCall(null);
    setIsIncomingMinimized(false);
    setConnection(null);
    stopIncomingAlerts();
    resetCall();
  };

  const resolveInboundCallEnd = async () => {
    const currentCall = activeCallRef.current;
    if (!currentCall || currentCall.callType !== 'inbound') {
      clearIncomingCallState();
      return;
    }

    if (currentCall.accepted || currentCall.logged) {
      clearIncomingCallState();
      return;
    }

    const {
      phoneNumber: pNum,
      localNumber,
      callSid,
      rejected,
      teammateAnswered,
      answeredBy: teammateAnsweredBy
    } = currentCall;
    const currentUserId = getUserId(currentUserRef.current);

    if (teammateAnswered && teammateAnsweredBy && String(teammateAnsweredBy) !== currentUserId) {
      await logCall({
        phoneNumber: pNum,
        localNumber,
        callType: 'inbound',
        status: 'answered-by-teammate',
        duration: 0,
        callSid,
        answeredBy: teammateAnsweredBy
      });
      clearIncomingCallState();
      return;
    }

    const session = callSid
      ? await fetchInboundSession({ callSid, phoneNumber: pNum, localNumber })
      : null;
    if (session?.status === 'answered' && session.answeredBy && String(session.answeredBy) !== currentUserId) {
      await logCall({
        phoneNumber: pNum,
        localNumber,
        callType: 'inbound',
        status: 'answered-by-teammate',
        duration: 0,
        callSid,
        answeredBy: session.answeredBy
      });
      clearIncomingCallState();
      return;
    }

    await logCall({
      phoneNumber: pNum,
      localNumber,
      callType: 'inbound',
      status: rejected ? 'rejected' : 'missed',
      duration: 0,
      callSid
    });
    clearIncomingCallState();
  };

  resolveInboundCallEndRef.current = resolveInboundCallEnd;

  const makeCall = async () => {
    if (!phoneNumber.trim()) return;
    if (!device || !isDeviceReady) {
      alert('Phone service is not ready yet. Wait for Ready status or tap Retry on the connection banner.');
      return;
    }

    setIsMinimized(false);
    setIsCalling(true);
    setCallStatus('Ringing...');
    setDuration(0);
    startTimeRef.current = null;

    try {
      const conn = await device.connect({ params: { To: phoneNumber.trim() } });
      setConnection(conn);
      activeCallRef.current = {
        callType: 'outbound',
        phoneNumber: phoneNumber.trim(),
        callSid: conn?.parameters?.CallSid || '',
        accepted: false,
        logged: false
      };

      conn.on('accept', () => {
        setCallStatus('Connected');
        startTimeRef.current = Date.now();
        activeCallRef.current = {
          ...activeCallRef.current,
          accepted: true,
          callSid: conn?.parameters?.CallSid || activeCallRef.current?.callSid || ''
        };
      });

      conn.on('disconnect', () => handleCallEnd(conn));
      conn.on('error', () => handleCallEnd(conn, { status: 'failed' }));
    } catch (err) {
      console.error(err);
      resetCall();
    }
  };

  const handleCallEnd = async (conn, overrides = {}) => {
    const finalDuration = startTimeRef.current
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : 0;

    await logCall({
      phoneNumber: overrides.phoneNumber || activeCallRef.current?.phoneNumber || phoneNumber.trim(),
      localNumber: overrides.localNumber || activeCallRef.current?.localNumber || '',
      callType: overrides.callType || activeCallRef.current?.callType || 'outbound',
      duration: finalDuration,
      status: overrides.status || 'completed',
      callSid: conn?.parameters?.CallSid || activeCallRef.current?.callSid || ''
    });

    resetCall();
  };

  const resetCall = () => {
    setIsCalling(false);
    setCallStatus(isDeviceReady ? 'Ready' : 'Device offline');
    setDuration(0);
    setConnection(null);
    setIsMuted(false);
    setIsOnHold(false);
    setIsSpeakerOn(false);
    setShowKeypad(false);
    setIsMinimized(false);
    setIsIncomingMinimized(false);
    startTimeRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleClose = () => {
    if (isCalling) {
      // Keep active call safe in background; minimize to floating pill
      setIsMinimized(true);
      return;
    }
    setIsMinimized(false);
    onClose?.();
  };

  const endCall = () => connection && connection.disconnect();

  const toggleMute = () => {
    if (connection) {
      const newMuted = !isMuted;
      connection.mute(newMuted);
      setIsMuted(newMuted);
    }
  };

  const toggleSpeaker = () => setIsSpeakerOn(!isSpeakerOn);

  const toggleHold = () => {
    if (connection) {
      const newHold = !isOnHold;
      connection.mute(newHold);
      setIsOnHold(newHold);
      setCallStatus(newHold ? 'On Hold' : 'Connected');
    }
  };

  const sendDTMF = (digit) => connection && connection.sendDigits(digit);

  const markCallAnswered = async ({ callSid, phoneNumber: pNum, localNumber }) => {
    if (!callSid) return;

    try {
      await fetch(`${BACKEND_URL}/api/calls/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ callSid, phoneNumber: pNum, localNumber })
      });
    } catch (err) {
      console.error('Failed to mark call answered:', err);
    }
  };

  const acceptIncomingCall = async () => {
    if (connection) {
      const parentCallSid = activeCallRef.current?.parentCallSid
        || getParentCallSid(connection)
        || activeCallRef.current?.callSid
        || '';

      connection.accept();
      activeCallRef.current = {
        ...(activeCallRef.current || {}),
        accepted: true,
        callSid: parentCallSid,
        parentCallSid
      };

      await markCallAnswered({
        callSid: parentCallSid,
        phoneNumber: activeCallRef.current?.phoneNumber,
        localNumber: activeCallRef.current?.localNumber
      });
      stopIncomingAlerts();
      setIncomingCall(null);
      setIsIncomingMinimized(false);
      setIsMinimized(false);
      setPhoneNumber(activeCallRef.current?.phoneNumber || '');
      setIsCalling(true);
      setCallStatus('Connected');
      startTimeRef.current = Date.now();
    }
  };

  const rejectIncomingCall = () => {
    if (connection) {
      activeCallRef.current = {
        ...(activeCallRef.current || {}),
        rejected: true
      };
      connection.reject();
    }
    stopIncomingAlerts();
    setIncomingCall(null);
    setIsIncomingMinimized(false);
    setConnection(null);
  };

  return (
    <div ref={boundaryRef} className="pointer-events-none fixed inset-0 z-[75] overflow-hidden">
      <AnimatePresence>
        {/* Floating Incoming Call Alert */}
        {incomingCall && !isIncomingMinimized && (
          <motion.div
            key="incoming-call-alert"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto absolute top-5 right-5 z-[85] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-emerald-500/40 bg-[#161B28]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl dialer-incoming-card"
          >
            <div className="flex items-center justify-between border-b border-gray-700/60 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Incoming Call</span>
              </div>
              <button
                type="button"
                onClick={() => setIsIncomingMinimized(true)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition"
                title="Minimize alert to pill"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>

            <div className="text-center py-2">
              <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400 mx-auto">
                <PhoneIncoming className="h-6 w-6 animate-bounce" />
              </div>
              {incomingContact?.name && (
                <p className="text-base font-bold text-white truncate px-2">{incomingContact.name}</p>
              )}
              <p className="font-mono text-sm text-gray-200">{incomingCall.from || 'Unknown Number'}</p>

              {incomingCall.lastHandledByName && (
                <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Recent company history</p>
                  <p className="mt-0.5 text-xs text-white">Last handled by {incomingCall.lastHandledByName}</p>
                  {incomingCall.lastHandledAt && (
                    <p className="text-[10px] text-gray-300">{formatLastHandledAt(incomingCall.lastHandledAt)}</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3.5 flex gap-2">
              <button
                type="button"
                onClick={rejectIncomingCall}
                className="flex-1 rounded-xl bg-gray-800 hover:bg-red-950/40 hover:text-red-300 border border-gray-700 py-2.5 text-xs font-semibold text-gray-300 transition"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={acceptIncomingCall}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
              >
                <Phone className="h-3.5 w-3.5" /> Accept Call
              </button>
            </div>
          </motion.div>
        )}

        {/* Minimized Incoming Call Pill */}
        {incomingCall && isIncomingMinimized && (
          <motion.div
            key="incoming-call-minimized"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="pointer-events-auto absolute bottom-5 right-5 z-[85] flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-[#161B28]/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => setIsIncomingMinimized(false)}
              className="flex items-center gap-2 text-left"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="min-w-0 pr-1">
                <span className="block text-xs font-semibold text-white truncate max-w-[120px]">
                  {incomingContact?.name || incomingCall.from || 'Incoming Call'}
                </span>
                <span className="block text-[10px] text-emerald-300">Ringing…</span>
              </span>
            </button>
            <button
              type="button"
              onClick={rejectIncomingCall}
              className="rounded-lg bg-gray-800 hover:bg-red-950/40 px-2 py-1.5 text-xs font-medium text-gray-300 hover:text-red-300 transition"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={acceptIncomingCall}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white transition"
            >
              Accept
            </button>
          </motion.div>
        )}

        {/* Minimized Active Call Pill */}
        {isCalling && isMinimized && !incomingCall && (
          <motion.div
            key="active-call-minimized"
            drag
            dragListener={false}
            dragControls={miniDragControls}
            dragConstraints={boundaryRef}
            dragMomentum={false}
            dragElastic={0}
            onPointerDown={(event) => {
              miniPointerStartRef.current = { x: event.clientX, y: event.clientY };
              miniDraggedRef.current = false;
              miniDragControls.start(event);
            }}
            onPointerMove={(event) => {
              const start = miniPointerStartRef.current;
              if (start && (Math.abs(event.clientX - start.x) > 5 || Math.abs(event.clientY - start.y) > 5)) {
                miniDraggedRef.current = true;
              }
            }}
            onPointerUp={() => {
              window.setTimeout(() => { miniPointerStartRef.current = null; }, 0);
            }}
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto absolute bottom-5 right-5 z-[75] flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-[#161B28]/95 px-3 py-2 shadow-[0_12px_36px_rgba(0,0,0,0.5)] backdrop-blur-xl dialer-minimized-card touch-none cursor-grab active:cursor-grabbing"
          >
            <button
              type="button"
              onClick={() => {
                if (miniDraggedRef.current) {
                  miniDraggedRef.current = false;
                  return;
                }
                setIsMinimized(false);
              }}
              className="flex items-center gap-2 text-left min-w-0"
              title="Click to expand dialer"
            >
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <div className="min-w-0 pr-1">
                <span className="block truncate text-xs font-semibold text-white max-w-[130px]">
                  {matchedContact?.name || phoneNumber || 'Active Call'}
                </span>
                <span className="block text-[11px] font-mono text-emerald-400 leading-tight">
                  {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')} • {callStatus}
                </span>
              </div>
            </button>

            {/* Quick in-pill controls */}
            <div className="flex items-center gap-1 shrink-0 ml-1">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={toggleMute}
                className={`rounded-lg p-1.5 transition ${isMuted ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={endCall}
                className="rounded-lg bg-red-600 hover:bg-red-500 p-1.5 text-white transition shadow"
                title="End call"
              >
                <PhoneOff className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setIsMinimized(false)}
                className="rounded-lg bg-gray-800 hover:bg-gray-700 p-1.5 text-gray-300 hover:text-white transition"
                title="Expand dialer"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Minimized Idle Dialer Pill */}
        {!isCalling && isOpen && isMinimized && !incomingCall && (
          <motion.div
            key="idle-dialer-minimized"
            drag
            dragListener={false}
            dragControls={miniDragControls}
            dragConstraints={boundaryRef}
            dragMomentum={false}
            dragElastic={0}
            onPointerDown={(event) => {
              miniPointerStartRef.current = { x: event.clientX, y: event.clientY };
              miniDraggedRef.current = false;
              miniDragControls.start(event);
            }}
            onPointerMove={(event) => {
              const start = miniPointerStartRef.current;
              if (start && (Math.abs(event.clientX - start.x) > 5 || Math.abs(event.clientY - start.y) > 5)) {
                miniDraggedRef.current = true;
              }
            }}
            onPointerUp={() => {
              window.setTimeout(() => { miniPointerStartRef.current = null; }, 0);
            }}
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto absolute bottom-5 right-5 z-[75] flex items-center gap-2 rounded-2xl border border-gray-700/80 bg-[#161B28]/95 px-3 py-2 shadow-2xl backdrop-blur-xl dialer-minimized-card touch-none cursor-grab active:cursor-grabbing"
          >
            <button
              type="button"
              onClick={() => {
                if (miniDraggedRef.current) {
                  miniDraggedRef.current = false;
                  return;
                }
                setIsMinimized(false);
              }}
              className="flex items-center gap-2 text-left"
              title="Click to expand dialer"
            >
              <span className="grid h-7 w-7 place-items-center rounded-xl bg-emerald-600 text-white shadow">
                <Phone className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 pr-1">
                <span className="block text-xs font-semibold text-white">Dialer</span>
                <span className="block text-[11px] text-gray-400 truncate max-w-[100px]">
                  {phoneNumber || 'Ready'}
                </span>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setIsMinimized(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition"
                title="Expand dialer"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setIsMinimized(false);
                  onClose?.();
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/20 hover:text-red-300 transition"
                title="Close dialer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Full Floating Dialer Window */}
        {(isOpen || isCalling) && !isMinimized && !incomingCall && (
          <motion.div
            key="floating-dialer-panel"
            drag
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={boundaryRef}
            dragMomentum={false}
            dragElastic={0}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto absolute bottom-5 right-5 z-[75] flex w-[min(345px,calc(100vw-2rem))] max-h-[calc(100vh-2.5rem)] flex-col rounded-2xl border border-gray-700/80 bg-[#161B28]/95 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl dialer-floating-card overflow-hidden touch-none"
          >
            {/* Header: drag handle, status, minimize, close */}
            <header
              onPointerDown={(event) => dragControls.start(event)}
              className="flex shrink-0 cursor-grab items-center justify-between border-b border-gray-700/70 bg-[#1C2333]/90 px-3.5 py-2.5 active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripHorizontal className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-xs font-semibold text-white">
                  {isCalling ? 'Active Call' : 'Dialer'}
                </span>
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isCalling
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : isDeviceReady
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isCalling || isDeviceReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {isCalling ? callStatus : isDeviceReady ? 'Ready' : 'Connecting'}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleMinimize}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-700 hover:text-white transition"
                  title="Minimize dialer"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleClose}
                  className={`rounded-lg p-1.5 transition ${
                    isCalling
                      ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                      : 'text-gray-400 hover:bg-red-500/20 hover:text-red-300'
                  }`}
                  title={isCalling ? 'Minimize active call' : 'Close dialer'}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* Scrollable Content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3.5 thin-scrollbar">
              {/* Phone service status banner (if not ready) */}
              {!isCalling && (
                <div className="mb-3">
                  <PhoneServiceAlert
                    deviceState={deviceState}
                    deviceError={deviceError}
                    onRetry={retryDeviceRegistration}
                  />
                </div>
              )}

              {/* In-Call Active Screen */}
              {isCalling ? (
                <div className="text-center">
                  <div className="rounded-2xl border border-gray-700/60 bg-gradient-to-b from-[#1C2436] to-[#141A28] p-4 text-center shadow-inner mb-3.5">
                    {matchedContact?.name && (
                      <p className="text-base font-bold text-white truncate px-2 mb-0.5">
                        {matchedContact.name}
                      </p>
                    )}
                    <p className="text-xs font-mono text-gray-300 mb-1">{phoneNumber}</p>
                    <p className="text-xs font-semibold text-emerald-400 mb-2">{callStatus}</p>

                    {startTimeRef.current && (
                      <p className="text-3xl font-mono font-light text-white my-2 tracking-wider">
                        {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                      </p>
                    )}
                  </div>

                  {/* Call Controls */}
                  <div className="grid grid-cols-4 gap-2 mb-3.5">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2.5 transition active:scale-95 ${
                        isMuted
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
                      }`}
                    >
                      {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      <span className="text-[10px] font-medium">{isMuted ? 'Muted' : 'Mute'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleSpeaker}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2.5 transition active:scale-95 ${
                        isSpeakerOn
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
                      }`}
                    >
                      {isSpeakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      <span className="text-[10px] font-medium">Speaker</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleHold}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2.5 transition active:scale-95 ${
                        isOnHold
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
                      }`}
                    >
                      {isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                      <span className="text-[10px] font-medium">{isOnHold ? 'Resume' : 'Hold'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowKeypad(!showKeypad)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2.5 transition active:scale-95 ${
                        showKeypad
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
                      }`}
                    >
                      <Grid className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Keypad</span>
                    </button>
                  </div>

                  {/* DTMF Keypad (when toggled) */}
                  {showKeypad && (
                    <div className="mb-3.5 grid grid-cols-3 gap-1.5 rounded-xl border border-gray-700/60 bg-[#121622] p-2">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => sendDTMF(digit)}
                          className="h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-base font-light text-white transition active:scale-95"
                        >
                          {digit}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* End Call Button */}
                  <button
                    type="button"
                    onClick={endCall}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 py-3 text-sm font-semibold text-white shadow-lg transition active:scale-[0.98]"
                  >
                    <PhoneOff className="h-4 w-4" />
                    End Call
                  </button>
                </div>
              ) : (
                /* Idle Dialer Keypad */
                <div>
                  {/* Number Display */}
                  <div className="mb-3 rounded-2xl border border-gray-700/60 bg-[#121622] p-3 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-400 mb-1">
                      UNITED STATES • +1
                    </p>
                    {matchedContact && (
                      <div className="mb-1 flex items-center justify-center gap-1 text-xs font-semibold text-emerald-300 truncate px-2">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{matchedContact.name}</span>
                      </div>
                    )}
                    <div className="flex min-h-[34px] items-center justify-center font-mono text-xl font-light tracking-wider text-white break-all px-2">
                      {phoneNumber || <span className="text-gray-500 font-sans text-sm">Enter phone number</span>}
                    </div>
                  </div>

                  {/* Keypad Grid */}
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {KEYPAD_BUTTONS.map((btn) => (
                      <button
                        key={btn.key}
                        type="button"
                        onClick={() => setPhoneNumber((prev) => prev + btn.key)}
                        className="flex h-11 flex-col items-center justify-center rounded-xl bg-[#1E2536] hover:bg-[#283248] active:bg-[#323E5A] text-white transition active:scale-95"
                      >
                        <span className="text-base font-medium leading-none">{btn.key}</span>
                        {btn.sub && (
                          <span className="text-[8px] font-medium tracking-widest text-gray-400 mt-0.5 leading-none">
                            {btn.sub}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Bottom Action Row */}
                  <div className="flex items-center justify-between px-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPhoneNumber('')}
                      disabled={!phoneNumber}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition disabled:opacity-30"
                      title="Clear number"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={makeCall}
                      disabled={!phoneNumber.trim() || !isDeviceReady}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/40 transition active:scale-95 disabled:bg-gray-700 disabled:opacity-40"
                      title="Place call"
                    >
                      <Phone className="h-6 w-6" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPhoneNumber((prev) => prev.slice(0, -1))}
                      disabled={!phoneNumber}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition disabled:opacity-30"
                      title="Backspace"
                    >
                      <Delete className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Dialer;
