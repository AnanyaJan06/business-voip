import { useState, useEffect, useRef } from 'react';
import { Device } from '@twilio/voice-sdk';

const BACKEND_URL = 'https://business-voip.onrender.com';
const DIALER_ANIMATION_MS = 220;

const getIncomingCallerNumber = (conn) => {
  const customFrom = conn?.customParameters?.get?.('originalFrom');
  return customFrom || conn?.parameters?.originalFrom || conn?.parameters?.From || 'Unknown Number';
};

const getIncomingAllottedNumber = (conn) => {
  const customTo = conn?.customParameters?.get?.('originalTo');
  return customTo || conn?.parameters?.originalTo || conn?.parameters?.To || '';
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
  const [shouldRenderDialer, setShouldRenderDialer] = useState(isOpen);
  const [dialerMotion, setDialerMotion] = useState(isOpen ? 'open' : 'closed');

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const activeCallRef = useRef(null);
  const dialerAnimationRef = useRef(null);
  const shouldShowFullDialer = (isOpen || isCalling) && !isMinimized;

  // Auto-fill from Contacts
  useEffect(() => {
    if (isOpen) setPhoneNumber(selectedPhoneNumber || '');
  }, [isOpen, selectedPhoneNumber]);

  useEffect(() => {
    clearTimeout(dialerAnimationRef.current);

    if (shouldShowFullDialer) {
      setShouldRenderDialer(true);
      setDialerMotion('opening');
      const frame = requestAnimationFrame(() => setDialerMotion('open'));
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(dialerAnimationRef.current);
      };
    }

    if (shouldRenderDialer) {
      setDialerMotion('closing');
      dialerAnimationRef.current = setTimeout(() => {
        setShouldRenderDialer(false);
      }, DIALER_ANIMATION_MS);
    }

    return () => clearTimeout(dialerAnimationRef.current);
  }, [shouldShowFullDialer, shouldRenderDialer]);

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
          const localNumber = getIncomingAllottedNumber(conn);
          console.log("📲 Incoming call from:", from);

          activeCallRef.current = {
            callType: 'inbound',
            phoneNumber: from,
            localNumber,
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
            const currentCall = activeCallRef.current;
            if (!currentCall?.accepted && !currentCall?.logged) {
              logCall({
                phoneNumber: from,
                localNumber,
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
                localNumber,
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

  const logCall = async ({ phoneNumber, localNumber, callType, duration, status, callSid }) => {
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
          localNumber,
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
      setDialerMotion('minimizing');
      clearTimeout(dialerAnimationRef.current);
      dialerAnimationRef.current = setTimeout(() => {
        setIsMinimized(true);
      }, DIALER_ANIMATION_MS);
      return;
    }

    setDialerMotion('closing');
    clearTimeout(dialerAnimationRef.current);
    dialerAnimationRef.current = setTimeout(() => {
      onClose?.();
    }, DIALER_ANIMATION_MS);
  };

  const restoreDialer = () => {
    clearTimeout(dialerAnimationRef.current);
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
        localNumber: activeCallRef.current?.localNumber || '',
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
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] px-4">
          <div className="bg-[#1C2333] border border-gray-600 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="flex justify-end -mt-2 -mr-2 mb-1">
              <button
                onClick={() => setIsIncomingMinimized(true)}
                className="text-gray-400 hover:text-white text-xl"
                title="Minimize incoming call"
              >
                −
              </button>
            </div>
            <div className="text-4xl mb-4 animate-pulse">📲</div>
            <p className="text-red-400 text-lg font-semibold mb-1">Incoming Call</p>
            <p className="text-xl font-medium text-white mb-6 break-all">
              {incomingCall.from || 'Unknown Number'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={rejectIncomingCall}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-all"
              >
                Reject
              </button>
              <button
                onClick={acceptIncomingCall}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl text-sm font-semibold transition-all"
              >
                Accept Call
              </button>
            </div>
          </div>
        </div>
      )}

      {incomingCall && isIncomingMinimized && (
        <div className="fixed bottom-4 right-4 z-[60] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-emerald-500/30 bg-[#161B28] px-3 py-3 shadow-2xl">
          <button
            onClick={() => setIsIncomingMinimized(false)}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              <span className="block truncate text-sm font-semibold text-white">{incomingCall.from || 'Incoming call'}</span>
              <span className="block text-xs text-emerald-300">Incoming call</span>
            </span>
          </button>
          <button
            onClick={rejectIncomingCall}
            className="rounded-lg bg-gray-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-600"
          >
            Reject
          </button>
          <button
            onClick={acceptIncomingCall}
            className="rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-500"
          >
            Accept
          </button>
        </div>
      )}

      {isCalling && isMinimized && (
        <button
          onClick={restoreDialer}
          className="dialer-minimized-card fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-emerald-500/30 bg-[#161B28] px-3 py-3 text-left shadow-2xl hover:bg-[#1C2333] transition"
        >
          <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            <span className="block truncate text-sm font-semibold text-white">{phoneNumber || 'Active call'}</span>
            <span className="block text-xs text-emerald-300">{callStatus}</span>
          </span>
        </button>
      )}

      {shouldRenderDialer && (
        <div className={`dialer-backdrop dialer-backdrop-${dialerMotion} fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-3 py-4`}>
          <div className={`dialer-panel dialer-panel-${dialerMotion} bg-[#161B28] border border-gray-700 rounded-2xl w-full max-w-[360px] shadow-2xl`}>
            <div className="flex justify-between items-center border-b border-gray-700 px-4 py-3">
              <h3 className="text-base font-semibold">{isCalling ? 'Active Call' : 'New Call'}</h3>
              <button
                onClick={handleCloseDialer}
                className="text-gray-400 hover:text-white text-xl"
                title={isCalling ? 'Minimize dialer' : 'Close dialer'}
              >
                {isCalling ? '−' : '✕'}
              </button>
            </div>

            <div className="p-4">
              <div className="w-full max-w-[270px] mx-auto">

      {/* Number Display */}
      <div className="bg-[#161B28] border border-gray-700 rounded-2xl p-4 mb-5 text-center">
        <p className="text-emerald-400 text-[11px] font-medium tracking-widest mb-1.5">UNITED STATES • +1</p>
        <div className="text-2xl font-light font-mono text-white min-h-[38px] flex items-center justify-center tracking-wider break-all">
          {phoneNumber}
        </div>
      </div>

      {/* In-Call Screen */}
      {isCalling ? (
        <div className="dialer-call-card bg-gradient-to-br from-[#1A2333] to-[#121A2A] border border-gray-700 rounded-2xl p-5 text-center">
          <p className="text-base font-medium text-white mb-1 break-all">{phoneNumber}</p>
          <p className={`text-sm text-emerald-400 font-medium ${showKeypad ? 'mb-2' : 'mb-4'}`}>{callStatus}</p>

          {startTimeRef.current && !showKeypad && (
            <p className="text-3xl font-mono font-light text-white mb-6">
              {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
            </p>
          )}

          <div className="min-h-[132px]">
            {showKeypad ? (
              <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
                  <button
                    key={d}
                    onClick={() => sendDTMF(d)}
                    className="h-9 bg-gray-800 hover:bg-gray-700 rounded-lg text-lg transition-all hover:scale-105 active:scale-95"
                  >
                    {d}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <button onClick={toggleMute} className="group p-3 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all hover:scale-105 active:scale-95 relative">
                  <div className="text-2xl">{isMuted ? '🔊' : '🔇'}</div>
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                    {isMuted ? 'Unmute' : 'Mute'}
                  </span>
                </button>

                <button onClick={toggleSpeaker} className="group p-3 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all hover:scale-105 active:scale-95 relative">
                  <div className="text-2xl">{isSpeakerOn ? '🔊' : '🎧'}</div>
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                    Speaker
                  </span>
                </button>

                <button onClick={toggleHold} className="group p-3 rounded-xl bg-gray-800 hover:bg-gray-700 transition-all hover:scale-105 active:scale-95 relative">
                  <div className="text-2xl">{isOnHold ? '▶' : '⏸'}</div>
                  <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                    {isOnHold ? 'Resume' : 'Hold'}
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className={`grid gap-2 ${showKeypad ? 'grid-cols-2 mt-3' : 'grid-cols-1'}`}>
            <button
              onClick={() => setShowKeypad(!showKeypad)}
              className={`${showKeypad ? 'py-2.5 text-xs' : 'py-3 text-sm'} bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-all`}
            >
              {showKeypad ? 'Hide Keypad' : 'Show Keypad'} ⌨️
            </button>

            <button
              onClick={endCall}
              className={`${showKeypad ? 'py-2.5 text-xs' : 'py-3.5 text-sm'} bg-red-600 hover:bg-red-700 rounded-xl font-semibold transition-all`}
            >
              End Call
            </button>
          </div>
        </div>
      ) : (
        /* Normal Dialer */
        <>
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map((key) => (
              <button
                key={key}
                onClick={() => setPhoneNumber(prev => prev + key)}
                className="h-12 bg-[#1F2937] hover:bg-[#374151] active:bg-[#4B5563] rounded-xl text-2xl font-light text-white transition-all active:scale-95"
              >
                {key}
              </button>
            ))}
          </div>

          <div className="flex justify-center gap-5">
            <button onClick={() => setPhoneNumber('')} className="w-11 h-11 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full text-2xl transition">✕</button>

            <button
              onClick={makeCall}
              disabled={!phoneNumber.trim()}
              className="w-16 h-16 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 rounded-full text-3xl shadow-xl shadow-emerald-500/30 transition-all active:scale-95"
            >
              📞
            </button>

            <button
              onClick={() => setPhoneNumber(prev => prev.slice(0, -1))}
              disabled={!phoneNumber}
              className="w-11 h-11 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full text-2xl transition disabled:opacity-40"
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
