import CallLog from '../model/CallLog.js';

export const saveCallLog = async (req, res) => {
  try {
    const { phoneNumber, callType, duration, status, recordingUrl, callSid } = req.body;
    const userId = req.user.id;

    const callLog = await CallLog.create({
      user: userId,
      phoneNumber,
      callType: callType || 'outbound',
      duration: duration || 0,
      status: status || 'completed',
      recordingUrl,
      callSid,
      endedAt: new Date()
    });

    res.status(201).json({ 
      message: 'Call logged successfully', 
      callLog 
    });
  } catch (error) {
    console.error('Save Call Log Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getCallLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const logs = await CallLog.find({ user: userId })
      .sort({ startedAt: -1 })
      .limit(100);

    res.json(logs);
  } catch (error) {
    console.error('Get Call Logs Error:', error);
    res.status(500).json({ message: error.message });
  }
};