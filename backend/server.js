import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import callRoutes from './routes/callRoutes.js';
import authRoutes from './routes/authRoutes.js';
import twilioRoutes from './routes/twilioRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import phoneNumberRoutes from './routes/phoneNumberRoutes.js';

dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

const io = new Server(server, {
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"] 
  }
});

// Make io accessible in controllers
app.set('io', io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/twilio', twilioRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/phone-numbers', phoneNumberRoutes);

app.get('/', (req, res) => res.send('✅ VoIP Backend is Running'));
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// Socket Connection
io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export { io }; // Optional export
