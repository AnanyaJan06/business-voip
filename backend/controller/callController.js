import CallLog from '../model/CallLog.js';

export const saveCallLog = async (req, res) => {
  try {
    const { phoneNumber, callType, duration, recordingUrl, status } = req.body;
    const userId = req.user.id;   // from auth middleware

    const callLog = await CallLog.create({
      user: userId,
      phoneNumber,
      callType,
      duration,
      recordingUrl,
      status,
      endedAt: new Date()
    });

    res.status(201).json({ message: 'Call log saved', callLog });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCallLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const logs = await CallLog.find({ user: userId })
      .sort({ startedAt: -1 })
      .populate('contact', 'name phone');
    
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};