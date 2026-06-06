import InternalMessage from '../model/InternalMessage.js';
import User from '../model/User.js';

const canMessageUser = (currentUser, otherUser) => {
  if (!otherUser || String(currentUser.id) === String(otherUser._id)) {
    return false;
  }

  if (currentUser.role === 'admin') {
    return ['admin', 'agent'].includes(otherUser.role);
  }

  return otherUser.role === 'admin';
};

const userFields = 'name email role';

export const getChatUsers = async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { _id: { $ne: req.user.id }, role: { $in: ['admin', 'agent'] } }
      : { role: 'admin', _id: { $ne: req.user.id } };

    const users = await User.find(query)
      .select(userFields)
      .sort({ role: 1, name: 1 });

    res.json(users);
  } catch (error) {
    console.error('Get Chat Users Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getConversation = async (req, res) => {
  try {
    const otherUser = await User.findById(req.params.userId).select(userFields);

    if (!canMessageUser(req.user, otherUser)) {
      return res.status(403).json({ message: 'You cannot view this conversation' });
    }

    const messages = await InternalMessage.find({
      $or: [
        { sender: req.user.id, recipient: otherUser._id },
        { sender: otherUser._id, recipient: req.user.id }
      ]
    })
      .populate('sender', userFields)
      .populate('recipient', userFields)
      .sort({ createdAt: 1 })
      .limit(200);

    await InternalMessage.updateMany(
      { sender: otherUser._id, recipient: req.user.id, readAt: { $exists: false } },
      { readAt: new Date() }
    );

    res.json(messages);
  } catch (error) {
    console.error('Get Conversation Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const sendInternalMessage = async (req, res) => {
  try {
    const body = String(req.body.body || '').trim();
    const recipient = await User.findById(req.body.recipientId).select(userFields);

    if (!canMessageUser(req.user, recipient)) {
      return res.status(403).json({ message: 'You cannot message this user' });
    }

    if (!body) {
      return res.status(400).json({ message: 'Message body is required' });
    }

    if (body.length > 2000) {
      return res.status(400).json({ message: 'Message body cannot exceed 2000 characters' });
    }

    const message = await InternalMessage.create({
      sender: req.user.id,
      recipient: recipient._id,
      body
    });

    const populatedMessage = await message.populate([
      { path: 'sender', select: userFields },
      { path: 'recipient', select: userFields }
    ]);

    const io = req.app.get('io');
    if (io) {
      io.emit('internal-message-created', {
        messageId: populatedMessage._id,
        sender: populatedMessage.sender,
        recipient: populatedMessage.recipient,
        createdAt: populatedMessage.createdAt
      });
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Send Internal Message Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getUnreadInternalMessageCount = async (req, res) => {
  try {
    const count = await InternalMessage.countDocuments({
      recipient: req.user.id,
      readAt: { $exists: false }
    });

    res.json({ count });
  } catch (error) {
    console.error('Get Internal Unread Count Error:', error);
    res.status(500).json({ message: error.message });
  }
};
