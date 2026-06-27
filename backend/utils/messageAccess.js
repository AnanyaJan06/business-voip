import { getAssignedNumberForUser, getAssignedNumbersForUser } from './twilioNumbers.js';

export const buildMessageAccessQuery = async (user) => {
  if (user.role === 'admin') return {};

  const assignedNumbers = await getAssignedNumbersForUser(user.id);
  const fallbackAssignedNumber = user.assignedPhoneNumber || await getAssignedNumberForUser(user.id);
  const recipientNumbers = [...new Set([
    ...assignedNumbers,
    fallbackAssignedNumber
  ].filter(Boolean))];

  return {
    $or: [
      { user: user.id },
      ...(recipientNumbers.length > 0 ? [{ direction: 'inbound', to: { $in: recipientNumbers } }] : [])
    ]
  };
};