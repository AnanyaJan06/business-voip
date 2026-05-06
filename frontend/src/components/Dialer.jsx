import { useState, useEffect, useRef } from 'react';
import { Device } from '@twilio/voice-sdk';
import io from 'socket.io-client';

const BACKEND_URL = 'https://business-voip.onrender.com';
const socket = io(BACKEND_URL);   // ← Socket defined here

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
  const [incomingCall, setIncomingCall] = useState(null);

  const startTimeRef = useRef(null);

  // Auto-fill from Contacts
  useEffect(() => {
    if (selectedPhoneNumber) setPhoneNumber(selectedPhoneNumber);
  }, [selectedPhoneNumber]);

  // Duration Timer
  useEffect(() => {
    let interval;
    if (startTimeRef.current) {
      interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [startTimeRef.current]);

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

  // Listen for Incoming Calls from Server
  useEffect(() => {
    socket.on('incoming-call', (data) => {
      console.log("Incoming call received:", data);
      setIncomingCall(data);
    });

    return () => {
      socket.off('incoming-call');
    };
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
      conn.on('error', (err) => handleCallEnd(conn));
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

  const sendDTMF = (digit) => {
    if (connection) connection.sendDigits(digit);
  };

  const acceptIncomingCall = () => {
    if (incomingCall) {
      setIncomingCall(null);
      setIsCalling(true);
      setCallStatus('Connected');
      startTimeRef.current = Date.now();
    }
  };

  return (
    <div className="w-full max-w-[320px] mx-auto">
      {/* Number Display */}
      <div className="bg-[#161B28] border border-gray-700 rounded-3xl p-8 mb-8 text-center">
        <p className="text-emerald-400 text-xs font-medium tracking-widest mb-3">UNITED STATES • +1</p>
        <div className="text-4xl font-light font-mono text-white min-h-[56px] flex items-center justify-center tracking-widest">
          {phoneNumber || 'Enter number'}
        </div>
      </div>

      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#1A2333] border border-gray-700 rounded-3xl p-8 text-center w-80">
            <p className="text-red-400 text-2xl mb-2">📲 Incoming Call</p>
            <p className="text-white text-xl mb-6">{incomingCall.from || 'Unknown Number'}</p>
            
            <div className="flex gap-4">
              <button
                onClick={() => setIncomingCall(null)}
                className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-2xl text-white"
              >
                Reject
              </button>
              <button
                onClick={acceptIncomingCall}
                className="flex-1 py-4 bg-green-600 hover:bg-green-500 rounded-2xl text-white font-semibold"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Call Screen */}
      {isCalling && (
        <div className="bg-gradient-to-br from-[#1A2333] to-[#121A2A] border border-gray-700 rounded-3xl p-8 text-center">
          <p className="text-xl font-medium text-white mb-1">{phoneNumber}</p>
          <p className="text-emerald-400 mb-6">{callStatus}</p>

          {startTimeRef.current && (
            <p className="text-5xl font-mono font-light text-white mb-10">
              {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
            </p>
          )}

          <div className="grid grid-cols-3 gap-4 mt-8">
            <button onClick={toggleMute} className={`p-5 rounded-2xl text-3xl ${isMuted ? 'bg-red-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
              {isMuted ? '🔊' : '🔇'}
            </button>

            <button onClick={toggleSpeaker} className={`p-5 rounded-2xl text-3xl ${isSpeakerOn ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
              {isSpeakerOn ? '🔊' : '🎧'}
            </button>

            <button onClick={toggleHold} className={`p-5 rounded-2xl text-3xl ${isOnHold ? 'bg-yellow-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
              {isOnHold ? '▶' : '⏸'}
            </button>
          </div>

          <button
            onClick={endCall}
            className="mt-10 w-full bg-red-600 hover:bg-red-700 py-5 rounded-2xl text-xl font-semibold"
          >
            End Call
          </button>
        </div>
      )}

      {/* Normal Dialer */}
      {!isCalling && (
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