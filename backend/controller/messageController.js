import twilio from 'twilio';
import MessageLog from '../model/MessageLog.js';
import '../model/User.js';

const getTwilioClient = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio SMS credentials are not configured');
  }

  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
};

const getSenderConfig = () => {
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    return { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID };
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    throw new Error('Twilio sender number is not configured');
  }

  return { from: process.env.TWILIO_PHONE_NUMBER };
};

const getPublicBaseUrl = () => (process.env.BASE_URL || '').replace(/\/$/, '');

export const sendMessage = async (req, res) => {
  try {
    const { to, body } = req.body;
    const trimmedTo = String(to || '').trim();
    const trimmedBody = String(body || '').trim();

    if (!trimmedTo || trimmedTo.replace(/\D/g, '').length < 7) {
      return res.status(400).json({ message: 'A valid recipient phone number is required' });
    }

    if (!trimmedBody) {
      return res.status(400).json({ message: 'Message body is required' });
    }

    if (trimmedBody.length > 1600) {
      return res.status(400).json({ message: 'Message body cannot exceed 1600 characters' });
    }

    const client = getTwilioClient();
    const senderConfig = getSenderConfig();
    const baseUrl = getPublicBaseUrl();

    const twilioMessage = await client.messages.create({
      ...senderConfig,
      to: trimmedTo,
      body: trimmedBody,
      ...(baseUrl ? { statusCallback: `${baseUrl}/api/messages/status` } : {})
    });

    const sender = senderConfig.from || process.env.TWILIO_MESSAGING_SERVICE_SID;
    const messageLog = await MessageLog.create({
      user: req.user.id,
      phoneNumber: trimmedTo,
      from: sender,
      to: trimmedTo,
      body: trimmedBody,
      direction: 'outbound',
      status: twilioMessage.status,
      messageSid: twilioMessage.sid
    });

    res.status(201).json({ message: 'Message sent', messageLog });
  } catch (error) {
    console.error('Send Message Error:', error);
    res.status(500).json({
      message: error.message,
      code: error.code
    });
  }
};

export const updateMessageStatus = async (req, res) => {
  try {
    console.log('Twilio message status webhook body:', req.body);

    const messageSid = req.body.MessageSid || req.body.SmsSid;
    const status = req.body.MessageStatus || req.body.SmsStatus;

    if (!messageSid || !status) {
      return res.status(400).json({ message: 'MessageSid and status are required' });
    }

    const update = {
      status,
      errorCode: req.body.ErrorCode || '',
      errorMessage: req.body.ErrorMessage || ''
    };

    if (status === 'delivered') {
      update.deliveredAt = new Date();
    }

    const messageLog = await MessageLog.findOneAndUpdate(
      { messageSid },
      update,
      { returnDocument: 'after' }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('message-status-updated', {
        messageSid,
        status,
        errorCode: update.errorCode,
        deliveredAt: messageLog?.deliveredAt
      });
    }

    res.sendStatus(204);
  } catch (error) {
    console.error('Message Status Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? {}
      : { $or: [{ user: req.user.id }, { direction: 'inbound' }] };

    const messages = await MessageLog.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(messages.map((message) => {
      const item = message.toObject();
      return {
        ...item,
        userName: item.user?.name || ''
      };
    }));
  } catch (error) {
    console.error('Get Messages Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const receiveMessage = async (req, res) => {
  try {
    const from = req.body.From || 'Unknown';
    const to = req.body.To || process.env.TWILIO_PHONE_NUMBER || 'Unknown';
    const body = req.body.Body || '';
    const messageSid = req.body.MessageSid || req.body.SmsSid || '';

    const messageLog = await MessageLog.create({
      phoneNumber: from,
      from,
      to,
      body,
      direction: 'inbound',
      status: req.body.SmsStatus || 'received',
      messageSid
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('incoming-message', {
        from,
        to,
        body,
        messageSid,
        createdAt: messageLog.createdAt
      });
    }

    const twiml = new twilio.twiml.MessagingResponse();
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Receive Message Error:', error);
    res.status(500).send('Internal Server Error');
  }
};
