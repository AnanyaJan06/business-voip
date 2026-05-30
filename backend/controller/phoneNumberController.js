import User from '../model/User.js';
import TwilioNumber from '../model/TwilioNumber.js';
import {
  ensureVoiceIdentity,
  getPublicBaseUrl,
  getTwilioClient,
  upsertTwilioNumber
} from '../utils/twilioNumbers.js';

const parseLimit = (value, fallback = 10, max = 50) => {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 1) return fallback;
  return Math.min(Math.floor(limit), max);
};

const serializeNumber = (number) => ({
  id: number._id,
  sid: number.sid,
  phoneNumber: number.phoneNumber,
  friendlyName: number.friendlyName,
  isoCountry: number.isoCountry,
  capabilities: number.capabilities,
  assignedTo: number.assignedTo,
  createdAt: number.createdAt,
  updatedAt: number.updatedAt
});

const buildWebhookConfig = () => {
  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) return {};

  return {
    voiceUrl: `${baseUrl}/api/twilio/incoming`,
    voiceMethod: 'POST',
    smsUrl: `${baseUrl}/api/messages/incoming`,
    smsMethod: 'POST'
  };
};

export const searchAvailableNumbers = async (req, res) => {
  try {
    const client = getTwilioClient();
    const limit = parseLimit(req.query.limit, 10, 20);
    const areaCode = String(req.query.areaCode || '').replace(/\D/g, '').slice(0, 3);
    const contains = String(req.query.contains || '').trim();

    const query = {
      limit,
      voiceEnabled: true,
      smsEnabled: true
    };

    if (areaCode.length === 3) query.areaCode = areaCode;
    if (contains) query.contains = contains;

    const numbers = await client.availablePhoneNumbers('US').local.list(query);

    res.json(numbers.map((number) => ({
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      locality: number.locality,
      region: number.region,
      isoCountry: number.isoCountry,
      capabilities: number.capabilities
    })));
  } catch (error) {
    console.error('Search Twilio Numbers Error:', error);
    res.status(500).json({ message: error.message, code: error.code });
  }
};

export const listOwnedNumbers = async (req, res) => {
  try {
    const numbers = await TwilioNumber.find()
      .populate('assignedTo', 'name email role')
      .sort({ phoneNumber: 1 });

    res.json(numbers.map(serializeNumber));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const importOwnedNumbers = async (req, res) => {
  try {
    const client = getTwilioClient();
    const incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 100 });
    const webhookConfig = buildWebhookConfig();

    if (Object.keys(webhookConfig).length > 0) {
      await Promise.all(incomingNumbers.map((number) => (
        client.incomingPhoneNumbers(number.sid).update(webhookConfig)
      )));
    }

    const numbers = await Promise.all(incomingNumbers.map(upsertTwilioNumber));
    const populatedNumbers = await TwilioNumber.find({
      _id: { $in: numbers.map((number) => number._id) }
    }).populate('assignedTo', 'name email role');

    res.json(populatedNumbers.map(serializeNumber));
  } catch (error) {
    console.error('Import Twilio Numbers Error:', error);
    res.status(500).json({ message: error.message, code: error.code });
  }
};

export const buyNumber = async (req, res) => {
  try {
    const phoneNumber = String(req.body.phoneNumber || '').trim();
    const userId = req.body.userId || '';

    if (!phoneNumber) {
      return res.status(400).json({ message: 'phoneNumber is required' });
    }

    const client = getTwilioClient();
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber,
      ...buildWebhookConfig()
    });

    let number = await upsertTwilioNumber(purchased);

    if (userId) {
      await assignNumberToUserById(number._id, userId);
      number = await TwilioNumber.findById(number._id).populate('assignedTo', 'name email role');
    }

    res.status(201).json(serializeNumber(number));
  } catch (error) {
    console.error('Buy Twilio Number Error:', error);
    res.status(500).json({ message: error.message, code: error.code });
  }
};

const assignNumberToUserById = async (numberId, userId) => {
  const number = await TwilioNumber.findById(numberId);
  if (!number) {
    const error = new Error('Phone number not found');
    error.status = 404;
    throw error;
  }

  if (!userId) {
    if (number.assignedTo) {
      await User.findByIdAndUpdate(number.assignedTo, {
        assignedPhoneNumber: '',
        assignedPhoneNumberSid: ''
      });
    }

    number.assignedTo = null;
    await number.save();
    return number;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  await ensureVoiceIdentity(user);

  await TwilioNumber.updateMany({ assignedTo: user._id }, { assignedTo: null });

  if (number.assignedTo && String(number.assignedTo) !== String(user._id)) {
    await User.findByIdAndUpdate(number.assignedTo, {
      assignedPhoneNumber: '',
      assignedPhoneNumberSid: ''
    });
  }

  number.assignedTo = user._id;
  await number.save();

  user.assignedPhoneNumber = number.phoneNumber;
  user.assignedPhoneNumberSid = number.sid;
  await user.save();

  return number;
};

export const assignNumberToUser = async (req, res) => {
  try {
    const number = await assignNumberToUserById(req.params.id, req.body.userId || '');
    const populated = await TwilioNumber.findById(number._id).populate('assignedTo', 'name email role');

    res.json(serializeNumber(populated));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};
