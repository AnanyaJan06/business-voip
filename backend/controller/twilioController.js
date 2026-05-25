import twilio from 'twilio';
import dotenv from 'dotenv';
import CallLog from '../model/CallLog.js';
import CallTranscript from '../model/CallTranscript.js';

dotenv.config();

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const BROWSER_CLIENT_IDENTITY = process.env.TWILIO_CLIENT_IDENTITY || 'browser-client';

const getPublicBaseUrl = () => (process.env.BASE_URL || '').replace(/\/$/, '');

const addTranscription = (twiml, labelPrefix = 'call') => {
  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) {
    console.warn('BASE_URL is missing; call transcription webhook was not added.');
    return;
  }

  const start = twiml.start();
  start.transcription({
    statusCallbackUrl: `${baseUrl}/api/twilio/transcription`,
    track: 'both_tracks',
    inboundTrackLabel: `${labelPrefix}-inbound`,
    outboundTrackLabel: `${labelPrefix}-outbound`,
    transcriptionEngine: process.env.TWILIO_TRANSCRIPTION_ENGINE || 'google',
    enableAutomaticPunctuation: true,
    partialResults: false
  });
};

const parseJsonField = (value) => {
  if (!value) return {};

  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return {};
  }
};

const rebuildTranscriptText = (segments) => [...segments]
  .sort((a, b) => (a.sequenceId || 0) - (b.sequenceId || 0))
  .map((segment) => segment.text)
  .filter(Boolean)
  .join('\n');

const syncTranscriptToCallLog = async (transcript) => {
  if (!transcript?.callSid) return;

  await CallLog.updateMany(
    { callSid: transcript.callSid },
    {
      transcriptionText: transcript.text,
      transcriptionStatus: transcript.status,
      transcriptionSid: transcript.transcriptionSid,
      transcriptionSegments: transcript.segments,
      transcriptionError: transcript.error || ''
    }
  );
};

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
    addTranscription(twiml, 'outbound');

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
    addTranscription(twiml, 'inbound');

    const client = twiml.dial({
      answerOnBridge: true,
      callerId: process.env.TWILIO_PHONE_NUMBER
    }).client(BROWSER_CLIENT_IDENTITY);

    client.parameter({
      name: 'originalFrom',
      value: from
    });

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

export const transcriptionStatus = async (req, res) => {
  try {
    const {
      CallSid,
      TranscriptionSid,
      TranscriptionEvent,
      TranscriptionData,
      TranscriptionErrorCode,
      TranscriptionErrorMessage,
      SequenceId,
      Track,
      Timestamp,
      Final
    } = req.body;

    if (!CallSid) {
      return res.status(400).json({ message: 'CallSid is required' });
    }

    const eventAt = Timestamp ? new Date(Timestamp) : new Date();
    const update = {
      callSid: CallSid,
      transcriptionSid: TranscriptionSid,
      lastEventAt: Number.isNaN(eventAt.getTime()) ? new Date() : eventAt
    };

    let transcript = await CallTranscript.findOneAndUpdate(
      { callSid: CallSid },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (TranscriptionEvent === 'transcription-started') {
      transcript.status = 'started';
    }

    if (TranscriptionEvent === 'transcription-content') {
      const data = parseJsonField(TranscriptionData);
      const text = String(data.transcript || '').trim();
      const sequenceId = Number(SequenceId) || 0;
      const isFinal = String(Final).toLowerCase() !== 'false';

      transcript.status = 'in-progress';

      if (text && isFinal) {
        const nextSegment = {
          sequenceId,
          track: Track,
          text,
          confidence: Number.isFinite(Number(data.confidence)) ? Number(data.confidence) : undefined,
          final: isFinal,
          timestamp: Number.isNaN(eventAt.getTime()) ? new Date() : eventAt
        };

        const existingIndex = transcript.segments.findIndex((segment) => (
          segment.sequenceId === sequenceId && segment.track === Track
        ));

        if (existingIndex >= 0) {
          transcript.segments[existingIndex] = nextSegment;
        } else {
          transcript.segments.push(nextSegment);
        }

        transcript.text = rebuildTranscriptText(transcript.segments);
      }
    }

    if (TranscriptionEvent === 'transcription-stopped') {
      transcript.status = 'completed';
      transcript.text = rebuildTranscriptText(transcript.segments);
    }

    if (TranscriptionEvent === 'transcription-error') {
      transcript.status = 'failed';
      transcript.error = TranscriptionErrorMessage || TranscriptionErrorCode || 'Transcription failed';
    }

    transcript = await transcript.save();
    await syncTranscriptToCallLog(transcript);

    const io = req.app.get('io');
    if (io) {
      io.emit('call-transcription-updated', {
        callSid: transcript.callSid,
        status: transcript.status
      });
    }

    res.sendStatus(204);
  } catch (error) {
    console.error('Transcription Webhook Error:', error);
    res.status(500).json({ message: error.message });
  }
};
