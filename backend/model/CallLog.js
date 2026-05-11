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
  phoneNumber: { 
    type: String, 
    required: true 
  },
  callType: { 
    type: String, 
    enum: ['outbound', 'inbound', 'missed'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['completed', 'missed', 'rejected', 'failed', 'busy', 'no-answer'], 
    default: 'completed' 
  },
  duration: { 
    type: Number, 
    default: 0  
  },
  recordingUrl: { type: String },
  callSid: { type: String },           // Important for Twilio
  startedAt: { 
    type: Date, 
    default: Date.now 
  },
  endedAt: { type: Date }
}, {
  timestamps: true   // Automatically adds createdAt & updatedAt
});

export default mongoose.model('CallLog', callLogSchema);
