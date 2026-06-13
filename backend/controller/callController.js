import CallLog from '../model/CallLog.js';
import CallTranscript from '../model/CallTranscript.js';
import { getAssignedNumberForUser } from '../utils/twilioNumbers.js';
import '../model/User.js';

export const saveCallLog = async (req, res) => {
  try {
    const { phoneNumber, callType, duration = 0, status, callSid, localNumber } = req.body;
    const resolvedCallType = callType || 'outbound';
    const startedAt = new Date();
    const transcriptQuery = {
      $or: [
        ...(callSid ? [{ callSid }] : []),
        {
          phoneNumber,
          callType: resolvedCallType,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      ]
    };
    const transcript = await CallTranscript.findOne(transcriptQuery).sort({ updatedAt: -1 });
    const resolvedLocalNumber = String(localNumber || transcript?.localNumber || '').trim()
      || (resolvedCallType === 'outbound' ? await getAssignedNumberForUser(req.user.id) : '');

    const callLogData = {
      user: req.user.id,
      phoneNumber,
      localNumber: resolvedLocalNumber,
      callType: resolvedCallType,
      duration: Number(duration) || 0,        // Ensure it's a number
      status: status || 'completed',
      callSid,
      transcriptionText: transcript?.text || '',
      transcriptionStatus: transcript?.status || 'not-started',
      transcriptionSid: transcript?.transcriptionSid || '',
      transcriptionSegments: transcript?.segments || [],
      transcriptionError: transcript?.error || '',
      startedAt,
      endedAt: startedAt
    };

    const duplicateQuery = callSid
      ? { callSid }
      : {
          user: req.user.id,
          phoneNumber,
          localNumber: resolvedLocalNumber,
          callType: resolvedCallType,
          status: status || 'completed',
          startedAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) }
        };

    const callLog = callSid || resolvedCallType === 'inbound'
      ? await CallLog.findOneAndUpdate(
          duplicateQuery,
          { $set: callLogData },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        )
      : await CallLog.create(callLogData);
    console.log("Call Log",callLog);
    

    res.status(201).json({ message: 'Call logged successfully', callLog });
  } catch (error) {
    console.error('Save Call Log Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getCallLogs = async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { user: req.user.id };
    const logs = await CallLog.find(query)
      .populate('user', 'name email role')
      .sort({ startedAt: -1 })
      .limit(100);

    const formattedLogs = logs.map((log) => {
      const item = log.toObject();

      return {
        ...item,
        userName: item.user?.name || 'Unknown User',
        userEmail: item.user?.email || ''
      };
    });

    res.json(formattedLogs);
  } catch (error) {
    console.error('Get Call Logs Error:', error);
    res.status(500).json({ message: error.message });
  }
};
