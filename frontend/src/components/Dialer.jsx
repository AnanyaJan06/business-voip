import { useState, useEffect, useRef } from 'react';
import { Device } from '@twilio/voice-sdk';

const BACKEND_URL = 'https://business-voip.onrender.com';

const getIncomingCallerNumber = (conn) => {
  const customFrom = conn?.customParameters?.get?.('originalFrom');
  return customFrom || conn?.parameters?.originalFrom || conn?.parameters?.From || 'Unknown Number';
};

function Dialer({ selectedPhoneNumber = '', isOpen = true, onClose }) {
  const [phoneNumber, setPhoneNumber] = useState(selectedPhoneNumber);
  const [device, setDevice] = useState(null);
  const [connection, setConnection] = useState(null);
  const [callStatus, setCallStatus] = useState('Ready');
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

  // Auto-fill from Contacts
  useEffect(() => {
    if (isOpen) setPhoneNumber(selectedPhoneNumber || '');
  }, [isOpen, selectedPhoneNumber]);

  // Duration Timer
  useEffect(() => {
    if (startTimeRef.current) {
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isCalling]);

  // Initialize Twilio Device + Incoming Call Listener
  useEffect(() => {
    let twilioDevice;

    const initDevice = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/twilio/token`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        if (!res.ok || !data.token) {
          throw new Error(data.message || 'Unable to get Twilio token');
        }

        twilioDevice = new Device(data.token, {
          edge: ['singapore', 'tokyo'],
          logLevel: 'warn',
        });

        // Listen for Incoming Calls
        twilioDevice.on('incoming', (conn) => {
          const from = getIncomingCallerNumber(conn);
          console.log("📲 Incoming call from:", from);

          activeCallRef.current = {
            callType: 'inbound',
            phoneNumber: from,
            callSid: conn.parameters.CallSid || '',
            accepted: false,
            logged: false
          };

          setIncomingCall({
            from,
            callSid: conn.parameters.CallSid
          });
          setIsIncomingMinimized(false);
          setConnection(conn);

          const logMissedCall = () => {
            if (!activeCallRef.current?.accepted) {
              logCall({
                phoneNumber: from,
                callType: 'inbound',
                status: 'missed',
                duration: 0,
                callSid: conn.parameters.CallSid || ''
              });
            }
            setIncomingCall(null);
            setIsIncomingMinimized(false);
            setConnection(null);
            resetCall();
          };

          conn.on('cancel', logMissedCall);
          conn.on('disconnect', () => {
            if (activeCallRef.current?.accepted) {
              handleCallEnd(conn, {
                phoneNumber: from,
                callType: 'inbound',
                status: 'completed'
              });
            } else {
              logMissedCall();
            }
          });
          conn.on('reject', () => {
            setIncomingCall(null);
            setIsIncomingMinimized(false);
            setConnection(null);
            resetCall();
          });
          conn.on('error', logMissedCall);
        });

        twilioDevice.on('registered', () => setCallStatus('Ready'));
        twilioDevice.on('error', (err) => {
          console.error('Twilio Device Error:', err);
          setCallStatus('Device error');
        });

        await twilioDevice.register();
        setDevice(twilioDevice);

        console.log("✅ Twilio Device Registered");
      } catch (err) {
        console.error("Device Initialization Error:", err);
        setCallStatus('Device offline');
      }
    };

    initDevice();

    return () => {
      if (twilioDevice) {
        twilioDevice.destroy();
      }
    };
    // The Twilio Device should be created once for this mounted dialer.
    // Event handlers read current call data from refs to avoid re-registering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logCall = async ({ phoneNumber, callType, duration, status, callSid }) => {
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
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          phoneNumber,
          callType,
          duration,
          status,
          callSid
        })
      });

      window.dispatchEvent(new Event('refreshCallHistory'));
    } catch (err) {
      console.error(err);
    }
  };

  const makeCall = async () => {
    if (!device || !phoneNumber.trim()) return alert("Please enter a valid number");

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
      callType: overrides.callType || activeCallRef.current?.callType || 'outbound',
      duration: finalDuration,
      status: overrides.status || 'completed',
      callSid: conn?.parameters?.CallSid || activeCallRef.current?.callSid || ''
    });

    resetCall();
  };

  const resetCall = () => {
    setIsCalling(false);
    setCallStatus('Call Ended');
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

  const handleCloseDialer = () => {
    if (isCalling) {
      setIsMinimized(true);
      return;
    }

    onClose?.();
  };

  const restoreDialer = () => {
    setIsMinimized(false);
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

  // Accept Incoming Call
  const acceptIncomingCall = () => {
    if (connection) {
      connection.accept();
      activeCallRef.current = {
        ...(activeCallRef.current || {}),
        accepted: true
      };
      setIncomingCall(null);
      setIsIncomingMinimized(false);
      setIsMinimized(false);
      setPhoneNumber(activeCallRef.current?.phoneNumber || '');
      setIsCalling(true);
      setCallStatus('Connected');
      startTimeRef.current = Date.now();
    }
  };

  // Reject Incoming Call
  const rejectIncomingCall = () => {
    if (connection) {
      logCall({
        phoneNumber: activeCallRef.current?.phoneNumber || incomingCall?.from || 'Unknown Number',
        callType: 'inbound',
        status: 'rejected',
        duration: 0,
        callSid: activeCallRef.current?.callSid || connection?.parameters?.CallSid || ''
      });
      connection.reject();
    }
    setIncomingCall(null);
    setIsIncomingMinimized(false);
    setConnection(null);
  };

  return (
    <>
      {/* Incoming Call Popup */}
      {incomingCall && !isIncomingMinimized && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]">
          <div className="bg-[#1C2333] border border-gray-600 rounded-3xl p-10 w-96 text-center shadow-2xl">
            <div className="flex justify-end -mt-4 -mr-4 mb-2">
              <button
                onClick={() => setIsIncomingMinimized(true)}
                className="text-gray-400 hover:text-white text-2xl"
                title="Minimize incoming call"
              >
                −
              </button>
            </div>
            <div className="text-6xl mb-6 animate-pulse">📲</div>
            <p className="text-red-400 text-2xl font-semibold mb-2">Incoming Call</p>
            <p className="text-3xl font-medium text-white mb-8">
              {incomingCall.from || 'Unknown Number'}
            </p>

            <div className="flex gap-4">
              <button
                onClick={rejectIncomingCall}
                className="flex-1 py-5 bg-gray-700 hover:bg-gray-600 rounded-2xl text-lg font-medium transition-all"
              >
                Reject
              </button>
              <button
                onClick={acceptIncomingCall}
                className="flex-1 py-5 bg-green-600 hover:bg-green-500 rounded-2xl text-lg font-semibold transition-all"
              >
                Accept Call
              </button>
            </div>
          </div>
        </div>
      )}

      {incomingCall && isIncomingMinimized && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-[#161B28] px-5 py-4 shadow-2xl">
          <button
            onClick={() => setIsIncomingMinimized(false)}
            className="flex items-center gap-3 text-left"
          >
            <span className="flex h-3 w-3 rounded-full bg-sky-400 animate-pulse" />
            <span>
              <span className="block text-sm font-semibold text-white">{incomingCall.from || 'Incoming call'}</span>
              <span className="block text-xs text-sky-300">Incoming call</span>
            </span>
          </button>
          <button
            onClick={rejectIncomingCall}
            className="rounded-xl bg-gray-700 px-3 py-2 text-sm font-medium text-white hover:bg-gray-600"
          >
            Reject
          </button>
          <button
            onClick={acceptIncomingCall}
            className="rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500"
          >
            Accept
          </button>
        </div>
      )}

      {isCalling && isMinimized && (
        <button
          onClick={restoreDialer}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[#161B28] px-5 py-4 text-left shadow-2xl hover:bg-[#1C2333] transition"
        >
          <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            <span className="block text-sm font-semibold text-white">{phoneNumber || 'Active call'}</span>
            <span className="block text-xs text-emerald-300">{callStatus}</span>
          </span>
        </button>
      )}

      {(isOpen || isCalling) && !isMinimized && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#161B28] border border-gray-700 rounded-3xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-700 px-6 py-4">
              <h3 className="text-xl font-semibold">{isCalling ? 'Active Call' : 'New Call'}</h3>
              <button
                onClick={handleCloseDialer}
                className="text-gray-400 hover:text-white text-2xl"
                title={isCalling ? 'Minimize dialer' : 'Close dialer'}
              >
                {isCalling ? '−' : '✕'}
              </button>
            </div>

            <div className="p-6">
              <div className="w-full max-w-[300px] mx-auto">

      {/* Number Display */}
      <div className="bg-[#161B28] border border-gray-700 rounded-3xl p-6 mb-8 text-center">
        <p className="text-emerald-400 text-xs font-medium tracking-widest mb-2">UNITED STATES • +1</p>
        <div className="text-4xl font-light font-mono text-white min-h-[52px] flex items-center justify-center tracking-widest">
          {phoneNumber}
        </div>
      </div>

      {/* In-Call Screen */}
      {isCalling ? (
        <div className="bg-gradient-to-br from-[#1A2333] to-[#121A2A] border border-gray-700 rounded-3xl p-8 text-center">
          <p className="text-xl font-medium text-white mb-1">{phoneNumber}</p>
          <p className="text-emerald-400 mb-6 font-medium">{callStatus}</p>

          {startTimeRef.current && (
            <p className="text-5xl font-mono font-light text-white mb-10">
              {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
            </p>
          )}

          <div className="grid grid-cols-3 gap-4 mb-6">
            <button onClick={toggleMute} className="group p-5 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-all hover:scale-105 active:scale-95 relative">
              <div className="text-3xl">{isMuted ? '🔊' : '🔇'}</div>
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                {isMuted ? 'Unmute' : 'Mute'}
              </span>
            </button>

            <button onClick={toggleSpeaker} className="group p-5 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-all hover:scale-105 active:scale-95 relative">
              <div className="text-3xl">{isSpeakerOn ? '🔊' : '🎧'}</div>
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                Speaker
              </span>
            </button>

            <button onClick={toggleHold} className="group p-5 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-all hover:scale-105 active:scale-95 relative">
              <div className="text-3xl">{isOnHold ? '▶' : '⏸'}</div>
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                {isOnHold ? 'Resume' : 'Hold'}
              </span>
            </button>
          </div>

          <button
            onClick={() => setShowKeypad(!showKeypad)}
            className="w-full py-4 bg-gray-800 hover:bg-gray-700 rounded-2xl text-sm font-medium mb-6"
          >
            {showKeypad ? 'Hide Keypad' : 'Show Keypad'} ⌨️
          </button>

          <button
            onClick={endCall}
            className="w-full bg-red-600 hover:bg-red-700 py-5 rounded-2xl text-lg font-semibold transition-all"
          >
            End Call
          </button>

          {showKeypad && (
            <div className="grid grid-cols-3 gap-3 mt-8">
              {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
                <button
                  key={d}
                  onClick={() => sendDTMF(d)}
                  className="py-5 bg-gray-800 hover:bg-gray-700 rounded-2xl text-2xl transition-all hover:scale-105 active:scale-95"
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Normal Dialer */
        <>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map((key) => (
              <button
                key={key}
                onClick={() => setPhoneNumber(prev => prev + key)}
                className="h-16 bg-[#1F2937] hover:bg-[#374151] active:bg-[#4B5563] rounded-2xl text-3xl font-light text-white transition-all active:scale-95"
              >
                {key}
              </button>
            ))}
          </div>

          <div className="flex justify-center gap-6">
            <button onClick={() => setPhoneNumber('')} className="w-14 h-14 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full text-3xl transition">✕</button>

            <button
              onClick={makeCall}
              disabled={!phoneNumber.trim()}
              className="w-20 h-20 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 rounded-full text-4xl shadow-xl shadow-emerald-500/30 transition-all active:scale-95"
            >
              📞
            </button>

            <button
              onClick={() => setPhoneNumber(prev => prev.slice(0, -1))}
              disabled={!phoneNumber}
              className="w-14 h-14 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full text-3xl transition disabled:opacity-40"
            >
              ⌫
            </button>
          </div>
        </>
      )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Dialer;
