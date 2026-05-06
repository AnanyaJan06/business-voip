import { useState, useEffect, useRef } from 'react';
import { Device } from '@twilio/voice-sdk';

const BACKEND_URL = 'https://business-voip.onrender.com';

function Dialer({ selectedPhoneNumber = '' }) {
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

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  // Auto-fill
  useEffect(() => {
    if (selectedPhoneNumber) setPhoneNumber(selectedPhoneNumber);
  }, [selectedPhoneNumber]);

  // Timer
  useEffect(() => {
    if (startTimeRef.current) {
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isCalling]);

  // Initialize Twilio
  useEffect(() => {
    const initDevice = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/twilio/token`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const twilioDevice = new Device(data.token, { 
          edge: ['singapore', 'tokyo'],
          logLevel: 'warn' 
        });
        twilioDevice.register();
        setDevice(twilioDevice);
      } catch (err) {
        console.error("Token error", err);
      }
    };
    initDevice();
  }, []);

  const makeCall = async () => {
    if (!device || !phoneNumber.trim()) return alert("Please enter a valid number");

    setIsCalling(true);
    setCallStatus('Ringing...');
    setDuration(0);
    startTimeRef.current = null;

    try {
      const conn = await device.connect({ params: { To: phoneNumber.trim() } });
      setConnection(conn);

      conn.on('accept', () => {
        setCallStatus('Connected');
        startTimeRef.current = Date.now();
      });

      conn.on('disconnect', () => handleCallEnd(conn));
      conn.on('error', () => handleCallEnd(conn));
    } catch (err) {
      console.error(err);
      resetCall();
    }
  };

  const handleCallEnd = async (conn) => {
    const finalDuration = startTimeRef.current 
      ? Math.floor((Date.now() - startTimeRef.current) / 1000) 
      : 0;

    try {
      await fetch(`${BACKEND_URL}/api/calls/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          callType: 'outbound',
          duration: finalDuration,
          status: 'completed',
          callSid: conn?.parameters?.CallSid || ''
        })
      });
    } catch (err) {
      console.error(err);
    }

    resetCall();
    window.dispatchEvent(new Event('refreshCallHistory'));
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
    startTimeRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const endCall = () => connection && connection.disconnect();
  const toggleMute = () => connection && connection.mute(!isMuted) && setIsMuted(!isMuted);
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

  return (
    <div className="w-full max-w-[300px] mx-auto">   {/* Smaller & Better Fit */}

      {/* Number Display */}
      <div className="bg-[#161B28] border border-gray-700 rounded-3xl p-6 mb-8 text-center">
        <p className="text-emerald-400 text-xs font-medium tracking-widest mb-2">UNITED STATES • +1</p>
        <div className="text-4xl font-light font-mono text-white min-h-[52px] flex items-center justify-center tracking-widest">
          {phoneNumber }
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

          {/* Control Buttons with Hover Labels */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <button
              onClick={toggleMute}
              className="group p-5 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-all duration-200 hover:scale-105 active:scale-95 relative"
            >
              <div className="text-3xl">{isMuted ? '🔊' : '🔇'}</div>
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap">
                {isMuted ? 'Unmute' : 'Mute'}
              </span>
            </button>

            <button
              onClick={toggleSpeaker}
              className="group p-5 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-all duration-200 hover:scale-105 active:scale-95 relative"
            >
              <div className="text-3xl">{isSpeakerOn ? '🔊' : '🎧'}</div>
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap">
                Speaker
              </span>
            </button>

            <button
              onClick={toggleHold}
              className="group p-5 rounded-2xl bg-gray-800 hover:bg-gray-700 transition-all duration-200 hover:scale-105 active:scale-95 relative"
            >
              <div className="text-3xl">{isOnHold ? '▶' : '⏸'}</div>
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap">
                {isOnHold ? 'Resume' : 'Hold'}
              </span>
            </button>
          </div>

          {/* Keypad Toggle */}
          <button
            onClick={() => setShowKeypad(!showKeypad)}
            className="w-full py-4 bg-gray-800 hover:bg-gray-700 rounded-2xl text-sm font-medium transition-all mb-6"
          >
            {showKeypad ? 'Hide Keypad' : 'Show Keypad'}
          </button>

          {/* End Call */}
          <button
            onClick={endCall}
            className="w-full bg-red-600 hover:bg-red-700 py-5 rounded-2xl text-lg font-semibold transition-all hover:scale-[1.02]"
          >
            End Call
          </button>

          {/* DTMF Keypad */}
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
  );
}

export default Dialer;