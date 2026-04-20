import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

// ====================== GET TOKEN FOR BROWSER ======================
export const getToken = async (req, res) => {
  try {
    const userId = req.user?.id || `user-${Date.now()}`;

    // Debug logs (remove later)
    console.log("TWILIO_ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID ? "✅ Present" : "❌ Missing");
    console.log("TWILIO_API_KEY_SID:", process.env.TWILIO_API_KEY_SID ? "✅ Present" : "❌ Missing");
    console.log("TWILIO_API_KEY_SECRET:", process.env.TWILIO_API_KEY_SECRET ? "✅ Present" : "❌ Missing");

    if (!process.env.TWILIO_API_KEY_SECRET) {
      return res.status(500).json({ message: "TWILIO_API_KEY_SECRET is missing in .env" });
    }

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY_SID,
      process.env.TWILIO_API_KEY_SECRET,
      { identity: userId }
    );

    const voiceGrant = new VoiceGrant({
      incomingAllow: true,
      outgoingAllow: true,
    });

    token.addGrant(voiceGrant);

    res.json({ token: token.toJwt() });
  } catch (error) {
    console.error('Token Generation Error:', error);
    res.status(500).json({ message: error.message });
  }
};


// ====================== MAKE OUTGOING CALL ======================
export const makeCall = async (req, res) => {
  try {
    const { to } = req.body;
    const userId = req.user?.id;

    const call = await client.calls.create({
      url: `${process.env.BASE_URL}/api/twilio/voice`,
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER,
    });

    res.json({ message: 'Call initiated', callSid: call.sid });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====================== TwiML VOICE RESPONSE ======================
export const voiceResponse = (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  twiml.say("Hello, connecting your call. Please wait...");

  const dial = twiml.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER,
    answerOnBridge: true,
  });

  dial.client("browser");

  res.type('text/xml');
  res.send(twiml.toString());
};