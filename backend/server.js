const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('✅ VoIP Backend is Running - Ready for USA Calls');
});

// Socket.io will be expanded later
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log('✅ Ready for USA VoIP calls with Twilio');
});