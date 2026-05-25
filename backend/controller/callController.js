import CallLog from '../model/CallLog.js';
import CallTranscript from '../model/CallTranscript.js';
import '../model/User.js';

export const saveCallLog = async (req, res) => {
  try {
    const { phoneNumber, callType, duration = 0, status, callSid } = req.body;
    const transcript = callSid ? await CallTranscript.findOne({ callSid }) : null;

    const callLog = await CallLog.create({
      user: req.user.id,
      phoneNumber,
      callType: callType || 'outbound',
      duration: Number(duration) || 0,        // Ensure it's a number
      status: status || 'completed',
      callSid,
      transcriptionText: transcript?.text || '',
      transcriptionStatus: transcript?.status || 'not-started',
      transcriptionSid: transcript?.transcriptionSid || '',
      transcriptionSegments: transcript?.segments || [],
      transcriptionError: transcript?.error || '',
      startedAt: new Date(),
      endedAt: new Date()
    });
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
