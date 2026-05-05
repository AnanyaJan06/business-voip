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
  const [showKeypad, setShowKeypad] = useState(false);

  const callStartTimeRef = useRef(null);
  const timerRef = useRef(null);

  // Auto-fill from Contacts
  useEffect(() => {
    if (selectedPhoneNumber) setPhoneNumber(selectedPhoneNumber);
  }, [selectedPhoneNumber]);

  // Timer - Runs ONLY after call is answered
  useEffect(() => {
    if (callStartTimeRef.current) {
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStartTimeRef.current]);

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
    callStartTimeRef.current = null;   // Reset

    try {
      const conn = await device.connect({
        params: { To: phoneNumber.trim() }
      });

      setConnection(conn);

      // Start timer ONLY when call is answered
      conn.on('accept', () => {
        setCallStatus('Connected');
        callStartTimeRef.current = Date.now();
      });

      conn.on('disconnect', () => handleCallEnd(conn));
      conn.on('error', (err) => {
        console.error(err);
        handleCallEnd(conn);
      });

    } catch (err) {
      console.error(err);
      resetCall();
    }
  };

  const handleCallEnd = async (conn) => {
    const finalDuration = callStartTimeRef.current 
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000) 
      : 0;

    console.log("Final Duration Saved:", finalDuration, "seconds");

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
      console.error("Failed to save call log", err);
    }

    resetCall();
    window.dispatchEvent(new Event('refreshCallHistory'));
  };

  const resetCall = () => {
    setIsCalling(false);
    setCallStatus('Call Ended');
    setDuration(0);
    setConnection(null);
    callStartTimeRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const endCall = () => {
    if (connection) connection.disconnect();
  };

  const toggleMute = () => {
    if (connection) {
      const newMuted = !isMuted;
      connection.mute(newMuted);
      setIsMuted(newMuted);
    }
  };

  const sendDTMF = (digit) => {
    if (connection) connection.sendDigits(digit);
  };

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white">Business VoIP</h1>
      </div>

      {isCalling && (
        <div className="bg-gray-900 border border-gray-700 rounded-3xl p-10 text-center">
          <p className="text-2xl font-semibold text-white">{phoneNumber}</p>
          <p className="text-green-400 text-xl mt-2">{callStatus}</p>

          {/* Timer appears ONLY after answered */}
          {callStartTimeRef.current && (
            <p className="text-5xl font-mono mt-6 text-white">
              {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
            </p>
          )}

          <div className="grid grid-cols-3 gap-4 mt-10">
            <button onClick={toggleMute} className={`p-6 rounded-2xl ${isMuted ? 'bg-red-600' : 'bg-gray-700'}`}>
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button onClick={() => setShowKeypad(!showKeypad)} className="p-6 rounded-2xl bg-gray-700">
              Keypad
            </button>
            <button onClick={endCall} className="p-6 rounded-2xl bg-red-600 hover:bg-red-700">
              End Call
            </button>
          </div>

          {showKeypad && (
            <div className="grid grid-cols-3 gap-3 mt-8">
              {['1','2','3','4','5','6','7','8','9','*','0','#'].map(digit => (
                <button key={digit} onClick={() => sendDTMF(digit)} className="py-6 bg-gray-800 hover:bg-gray-700 rounded-2xl text-2xl">
                  {digit}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!isCalling && (
        <div className="bg-gray-900 border border-gray-700 rounded-3xl p-10">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (415) 555-0123"
            className="w-full bg-gray-800 text-3xl text-center tracking-widest py-6 rounded-2xl border border-gray-700 focus:border-blue-500 text-white"
          />

          <button
            onClick={makeCall}
            disabled={!phoneNumber.trim()}
            className="mt-8 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-8 rounded-2xl text-2xl font-semibold transition"
          >
            📞 Call
          </button>
        </div>
      )}
    </div>
  );
}

export default Dialer;