import CallLog from '../model/CallLog.js';
import CallTranscript from '../model/CallTranscript.js';
import InboundCallSession from '../model/InboundCallSession.js';
import User from '../model/User.js';
import { getAssignedNumberForUser } from '../utils/twilioNumbers.js';

const formatCallLog = (log) => {
  const item = log.toObject();

  return {
    ...item,
    userName: item.user?.name || 'Unknown User',
    userEmail: item.user?.email || '',
    answeredByName: item.answeredBy?.name || ''
  };
};

export const saveCallLog = async (req, res) => {
  try {
    const { phoneNumber, callType, duration = 0, status, callSid, localNumber, answeredBy } = req.body;
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

    let resolvedAnsweredBy = answeredBy || undefined;
    if (status === 'answered-by-teammate' && callSid && !resolvedAnsweredBy) {
      const session = await InboundCallSession.findOne({ callSid }).select('answeredBy');
      resolvedAnsweredBy = session?.answeredBy || undefined;
    }

    const callLogData = {
      user: req.user.id,
      phoneNumber,
      localNumber: resolvedLocalNumber,
      callType: resolvedCallType,
      duration: Number(duration) || 0,
      status: status || 'completed',
      callSid,
      answeredBy: resolvedAnsweredBy,
      transcriptionText: transcript?.text || '',
      transcriptionStatus: transcript?.status || 'not-started',
      transcriptionSid: transcript?.transcriptionSid || '',
      transcriptionSegments: transcript?.segments || [],
      transcriptionError: transcript?.error || '',
      startedAt,
      endedAt: startedAt
    };

    const duplicateQuery = callSid
      ? { callSid, user: req.user.id }
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

    console.log('Call Log', callLog);

    res.status(201).json({ message: 'Call logged successfully', callLog });
  } catch (error) {
    console.error('Save Call Log Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const markCallAnswered = async (req, res) => {
  try {
    const { callSid } = req.body;
    if (!callSid) {
      return res.status(400).json({ message: 'callSid is required' });
    }

    const existingSession = await InboundCallSession.findOne({ callSid });
    if (!existingSession) {
      return res.status(404).json({ message: 'Inbound call session not found' });
    }

    if (existingSession.status === 'answered' && existingSession.answeredBy) {
      const answerer = await User.findById(existingSession.answeredBy).select('name email');
      return res.json({
        alreadyAnswered: true,
        session: existingSession,
        answeredBy: existingSession.answeredBy,
        answeredByName: answerer?.name || 'Teammate'
      });
    }

    const session = await InboundCallSession.findOneAndUpdate(
      { callSid, status: 'ringing' },
      {
        $set: {
          status: 'answered',
          answeredBy: req.user.id,
          answeredAt: new Date()
        }
      },
      { new: true }
    );

    if (!session) {
      const current = await InboundCallSession.findOne({ callSid });
      const answerer = current?.answeredBy
        ? await User.findById(current.answeredBy).select('name email')
        : null;

      return res.json({
        alreadyAnswered: true,
        session: current,
        answeredBy: current?.answeredBy,
        answeredByName: answerer?.name || 'Teammate'
      });
    }

    const answerer = await User.findById(req.user.id).select('name email');
    const io = req.app.get('io');
    if (io) {
      io.emit('call-answered-by-teammate', {
        callSid: session.callSid,
        phoneNumber: session.phoneNumber,
        localNumber: session.localNumber,
        answeredBy: req.user.id,
        answeredByName: answerer?.name || 'Teammate',
        assignedUserIds: session.assignedUserIds.map((id) => String(id))
      });
    }

    res.json({
      session,
      answeredBy: req.user.id,
      answeredByName: answerer?.name || 'Teammate'
    });
  } catch (error) {
    console.error('Mark Call Answered Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getInboundSession = async (req, res) => {
  try {
    const { callSid } = req.params;
    if (!callSid) {
      return res.status(400).json({ message: 'callSid is required' });
    }

    const session = await InboundCallSession.findOne({ callSid })
      .populate('answeredBy', 'name email');

    if (!session) {
      return res.status(404).json({ message: 'Inbound call session not found' });
    }

    res.json({
      callSid: session.callSid,
      phoneNumber: session.phoneNumber,
      localNumber: session.localNumber,
      status: session.status,
      answeredBy: session.answeredBy?._id || session.answeredBy || null,
      answeredByName: session.answeredBy?.name || '',
      assignedUserIds: session.assignedUserIds.map((id) => String(id))
    });
  } catch (error) {
    console.error('Get Inbound Session Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getCallLogs = async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { user: req.user.id };
    const logs = await CallLog.find(query)
      .populate('user', 'name email role')
      .populate('answeredBy', 'name email')
      .sort({ startedAt: -1 })
      .limit(100);

    const formattedLogs = logs.map(formatCallLog);

    res.json(formattedLogs);
  } catch (error) {
    console.error('Get Call Logs Error:', error);
    res.status(500).json({ message: error.message });
  }
};