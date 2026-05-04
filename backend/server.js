import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import callRoutes from './routes/callRoutes.js';
import authRoutes from './routes/authRoutes.js';
import twilioRoutes from './routes/twilioRoutes.js';
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());


app.use('/api/auth', authRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/twilio', twilioRoutes);

app.get('/', (req, res) => {
  res.send('✅ VoIP Backend is Running with ES Modules');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Ready for USA calls' });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});