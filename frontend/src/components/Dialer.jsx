import { useState, useEffect } from 'react';
import { Device } from '@twilio/voice-sdk';

function Dialer() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [device, setDevice] = useState(null);
  const [connection, setConnection] = useState(null);
  const [callStatus, setCallStatus] = useState('Ready');
  const [isCalling, setIsCalling] = useState(false);

  // Initialize Twilio Device
  useEffect(() => {
    const initDevice = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/twilio/token', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const twilioDevice = new Device(data.token);
        twilioDevice.register();
        setDevice(twilioDevice);
      } catch (err) {
        console.error("Token error", err);
      }
    };

    initDevice();
  }, []);

  const makeCall = async () => {
  if (!device || !phoneNumber) {
    return alert("Please enter a number and wait for device ready");
  }

  setIsCalling(true);
  setCallStatus('Calling...');

  try {
    const conn = await device.connect({
      params: { 
        To: phoneNumber,
        callerId: process.env.VITE_TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER // optional
      }
    });

    setConnection(conn);

    conn.on('disconnect', () => {
      setCallStatus('Call Ended');
      setIsCalling(false);
    });

    conn.on('error', (err) => {
      console.error("Call Error:", err);
      setCallStatus('Call Failed');
      setIsCalling(false);
    });

  } catch (err) {
    console.error("Connect failed:", err);
    alert("Failed to start call. Check console.");
    setIsCalling(false);
    setCallStatus('Ready');
  }
};

  const endCall = () => {
    if (connection) connection.disconnect();
    setConnection(null);
    setIsCalling(false);
    setCallStatus('Ready');
  };

  return (
    <div className="max-w-lg mx-auto mt-10">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-white">Business VoIP Dialer</h1>
        <p className="text-gray-400 mt-2">Make calls to USA numbers</p>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-3xl p-10">
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+1 (415) 555-0123"
          className="w-full bg-gray-800 text-3xl text-center tracking-widest py-6 rounded-2xl border border-gray-700 focus:border-blue-500 text-white"
        />

        <div className="flex gap-4 mt-8">
          <button
            onClick={makeCall}
            disabled={isCalling || !phoneNumber}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-8 rounded-2xl text-2xl font-semibold transition flex items-center justify-center gap-3"
          >
            📞 Call
          </button>

          <button
            onClick={endCall}
            disabled={!isCalling}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white py-8 rounded-2xl text-2xl font-semibold transition"
          >
            End Call
          </button>
        </div>

        <p className={`text-center mt-6 text-xl font-medium ${isCalling ? 'text-green-400' : 'text-gray-400'}`}>
          {callStatus}
        </p>
      </div>
    </div>
  );
}

export default Dialer;