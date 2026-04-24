import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

// getToken
export const getToken = async (req, res) => {
  try {
    const identity = `browser-${req.user?.id || Date.now()}`;

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY_SID,
      process.env.TWILIO_API_KEY_SECRET,
      { identity: identity }
    );

  const voiceGrant = new VoiceGrant({
  outgoingApplicationSid: process.env.TWIML_APP_SID,
  incomingAllow: true
});

    token.addGrant(voiceGrant);

    res.json({ 
      token: token.toJwt(),
      identity: identity 
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