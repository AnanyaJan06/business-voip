import twilio from 'twilio';
import User from '../model/User.js';
import TwilioNumber from '../model/TwilioNumber.js';

export const getTwilioClient = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials are not configured');
  }

  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
};

export const getPublicBaseUrl = () => (process.env.BASE_URL || '').replace(/\/$/, '');

export const toVoiceIdentity = (user) => {
  const id = user?._id || user?.id;
  if (!id) return '';
  return user.twilioIdentity || `user_${id.toString()}`;
};

export const ensureVoiceIdentity = async (user) => {
  const identity = toVoiceIdentity(user);

  if (user && !user.twilioIdentity) {
    user.twilioIdentity = identity;
    await user.save();
  }

  return identity;
};

export const normalizeClientIdentity = (value = '') => String(value).replace(/^client:/i, '');

export const normalizePhoneNumber = (value = '') => String(value).trim();

export const getAssignedNumberForUser = async (userId) => {
  const assigned = await TwilioNumber.findOne({ assignedTo: userId });
  if (assigned?.phoneNumber) return assigned.phoneNumber;

  const user = await User.findById(userId).select('assignedPhoneNumber');
  return user?.assignedPhoneNumber || process.env.TWILIO_PHONE_NUMBER || '';
};

export const getAssignedNumberByIdentity = async (identity) => {
  if (!identity) return process.env.TWILIO_PHONE_NUMBER || '';

  const user = await User.findOne({ twilioIdentity: normalizeClientIdentity(identity) });
  if (!user) return process.env.TWILIO_PHONE_NUMBER || '';

  return getAssignedNumberForUser(user._id);
};

export const upsertTwilioNumber = async (number) => TwilioNumber.findOneAndUpdate(
  { sid: number.sid },
  {
    sid: number.sid,
    phoneNumber: number.phoneNumber,
    friendlyName: number.friendlyName || '',
    isoCountry: number.isoCountry || 'US',
    capabilities: {
      voice: Boolean(number.capabilities?.voice),
      sms: Boolean(number.capabilities?.sms),
      mms: Boolean(number.capabilities?.mms)
    }
  },
  { new: true, upsert: true, setDefaultsOnInsert: true }
);
