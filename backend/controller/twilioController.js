import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const BROWSER_CLIENT_IDENTITY = process.env.TWILIO_CLIENT_IDENTITY || 'browser-client';

// getToken
export const getToken = async (req, res) => {
  try {
    const identity = BROWSER_CLIENT_IDENTITY;

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY_SID,
      process.env.TWILIO_API_KEY_SECRET,
      { identity }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWIML_APP_SID,
      incomingAllow: true
    });

    token.addGrant(voiceGrant);

    res.json({
      token: token.toJwt(),
      identity
    });
  } catch (error) {
    console.error('Token Error:', error);
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

// voiceResponse (TwiML)
export const voiceResponse = (req, res) => {
  try {
    console.log("Twilio webhook body:", req.body); // <-- Added log

    const twiml = new twilio.twiml.VoiceResponse();

    const to = req.body.To;

    if (!to) {
      console.log("No destination number received");
      return res.status(400).send("Missing destination number");
    }

    const dial = twiml.dial({
      callerId: process.env.TWILIO_PHONE_NUMBER,
      answerOnBridge: true
    });

    dial.number(to);

    console.log("Calling number:", to);
    console.log("Generated TwiML:", twiml.toString());

    res.type("text/xml");
    res.send(twiml.toString());

  } catch (error) {
    console.error("Voice Response Error:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Handle Incoming Calls
export const incomingVoice = async (req, res) => {
  try {
    const from = req.body.From || 'Unknown';
    const callSid = req.body.CallSid;

    console.log(`📲 Incoming call from: ${from} | SID: ${callSid}`);

    const io = req.app.get('io');
    if (io) {
      io.emit('incoming-call', {
        from: from,
        callSid: callSid,
        timestamp: new Date().toISOString()
      });
    }

    const twiml = new twilio.twiml.VoiceResponse();

    twiml.dial({
      answerOnBridge: true,
      callerId: process.env.TWILIO_PHONE_NUMBER
    }).client(BROWSER_CLIENT_IDENTITY);

    res.type('text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error("Incoming Voice Error:", error);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Sorry, we are unable to connect the call right now.");
    res.type('text/xml');
    res.send(twiml.toString());
  }
};
