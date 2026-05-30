import User from '../model/User.js';
import TwilioNumber from '../model/TwilioNumber.js';
import {
  ensureVoiceIdentity,
  getPublicBaseUrl,
  getTwilioClient,
  upsertTwilioNumber
} from '../utils/twilioNumbers.js';

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

const updateNumberWebhooks = async (client, number) => {
  const webhookConfig = buildWebhookConfig();
  if (Object.keys(webhookConfig).length === 0) return number;

  return client.incomingPhoneNumbers(number.sid).update(webhookConfig);
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

export const syncPurchasedNumbers = async (req, res) => {
  try {
    const client = getTwilioClient();
    console.log("Client",client);
    
    console.log('[Twilio Sync] Starting purchased number sync...');

    const incomingNumbers = await client.incomingPhoneNumbers.list({ limit: 100 });
    const importedSids = incomingNumbers.map((number) => number.sid);
    const importedPhoneNumbers = incomingNumbers.map((number) => number.phoneNumber);

    console.log(`[Twilio Sync] Fetched ${incomingNumbers.length} purchased number(s) from Twilio.`);
    console.log('[Twilio Sync] Purchased numbers:', importedPhoneNumbers);

    await Promise.all(incomingNumbers.map((number) => updateNumberWebhooks(client, number)));
    console.log('[Twilio Sync] Webhook URLs updated for fetched numbers.');

    const staleNumbers = await TwilioNumber.find({
      sid: { $nin: importedSids }
    });

    if (staleNumbers.length > 0) {
      console.log('[Twilio Sync] Removing stale numbers:', staleNumbers.map((number) => number.phoneNumber));

      await User.updateMany(
        { assignedPhoneNumberSid: { $in: staleNumbers.map((number) => number.sid) } },
        { assignedPhoneNumber: '', assignedPhoneNumberSid: '' }
      );

      await TwilioNumber.deleteMany({
        _id: { $in: staleNumbers.map((number) => number._id) }
      });
    } else {
      console.log('[Twilio Sync] No stale numbers found.');
    }

    const numbers = await Promise.all(incomingNumbers.map(upsertTwilioNumber));
    const populatedNumbers = await TwilioNumber.find({
      _id: { $in: numbers.map((number) => number._id) }
    })
      .populate('assignedTo', 'name email role')
      .sort({ phoneNumber: 1 });

    console.log('[Twilio Sync] Stored numbers in TwilioNumber collection:', populatedNumbers.map((number) => ({
      phoneNumber: number.phoneNumber,
      assignedTo: number.assignedTo?.email || 'Unassigned'
    })));
    console.log('[Twilio Sync] Sync completed.');

    res.json(populatedNumbers.map(serializeNumber));
  } catch (error) {
    console.error('Sync Twilio Numbers Error:', error);
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
