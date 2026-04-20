import mongoose from 'mongoose';

const callLogSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  contact: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Contact' 
  },
  phoneNumber: { type: String, required: true },
  callType: { 
    type: String, 
    enum: ['inbound', 'outbound', 'missed'], 
    required: true 
  },
  duration: { type: Number, default: 0 }, // in seconds
  recordingUrl: { type: String },
  status: { 
    type: String, 
    enum: ['completed', 'missed', 'failed'], 
    default: 'completed' 
  },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
});

export default mongoose.model('CallLog', callLogSchema);