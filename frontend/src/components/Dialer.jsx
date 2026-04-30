import { useState, useEffect } from 'react';
import { Device } from '@twilio/voice-sdk';

const BACKEND_URL = 'https://business-voip.onrender.com';

function Dialer() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [device, setDevice] = useState(null);
  const [connection, setConnection] = useState(null);
  const [callStatus, setCallStatus] = useState('Ready');
  const [isCalling, setIsCalling] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [callerName, setCallerName] = useState('');

  // Timer for active call
  useEffect(() => {
    let timer;
    if (isCalling && connection) {
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(timer);
  }, [isCalling, connection]);

  // Initialize Device
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
    if (!device || !phoneNumber) return alert("Enter a valid number");

    setIsCalling(true);
    setCallStatus('Calling...');
    setDuration(0);
    setCallerName(phoneNumber); // Temporary - later we can show contact name

    try {
      const conn = await device.connect({
        params: { To: phoneNumber.trim() }
      });

      setConnection(conn);

      conn.on('accept', () => setCallStatus('Connected'));
      conn.on('disconnect', () => handleCallEnd());
      conn.on('error', (err) => {
        console.error(err);
        setCallStatus('Call Failed');
        setIsCalling(false);
      });
    } catch (err) {
      console.error(err);
      setCallStatus('Failed to Connect');
      setIsCalling(false);
    }
  };

  const handleCallEnd = () => {
    setCallStatus('Call Ended');
    setIsCalling(false);
    setConnection(null);
    setIsMuted(false);
    setIsOnHold(false);
    setShowKeypad(false);
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

  const toggleHold = () => {
    if (connection) {
      // Basic hold simulation
      setIsOnHold(!isOnHold);
      setCallStatus(isOnHold ? 'Connected' : 'On Hold');
    }
  };

  const sendDTMF = (digit) => {
    if (connection) {
      connection.sendDigits(digit);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white">Business VoIP</h1>
      </div>

      {/* In-Call Screen */}
      {isCalling && (
        <div className="bg-gray-900 border border-gray-700 rounded-3xl p-10 text-center">
          <div className="mb-6">
            <p className="text-2xl font-semibold text-white">{callerName || phoneNumber}</p>
            <p className="text-green-400 text-xl mt-2">{callStatus}</p>
            <p className="text-4xl font-mono mt-4 text-white">{Math.floor(duration/60)}:{(duration%60).toString().padStart(2, '0')}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-10">
            <button onClick={toggleMute} className={`p-6 rounded-2xl ${isMuted ? 'bg-red-600' : 'bg-gray-700'}`}>
              {isMuted ? '🎤 Unmute' : '🎤 Mute'}
            </button>
            <button onClick={toggleHold} className={`p-6 rounded-2xl ${isOnHold ? 'bg-yellow-600' : 'bg-gray-700'}`}>
              {isOnHold ? '▶ Resume' : '⏸ Hold'}
            </button>
            <button onClick={() => setShowKeypad(!showKeypad)} className="p-6 rounded-2xl bg-gray-700">
              ⌨️ Keypad
            </button>
          </div>

          {showKeypad && (
            <div className="grid grid-cols-3 gap-3 mt-8">
              {['1','2','3','4','5','6','7','8','9','*','0','#'].map(digit => (
                <button key={digit} onClick={() => sendDTMF(digit)} className="py-6 bg-gray-800 hover:bg-gray-700 rounded-2xl text-2xl font-mono">
                  {digit}
                </button>
              ))}
            </div>
          )}

          <button onClick={endCall} className="mt-10 w-full bg-red-600 hover:bg-red-700 py-6 rounded-2xl text-xl font-semibold">
            End Call
          </button>
        </div>
      )}

      {/* Normal Dialer */}
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
            disabled={!phoneNumber}
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