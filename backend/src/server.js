const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const storeRoutes = require('./routes/storeRoutes');

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((s) => s.trim())
  : null;

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins) return allowedOrigins.includes(origin);
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
    origin
  );
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join:store', (storeId) => {
    if (storeId) {
      socket.join(`store:${storeId}`);
    }
  });
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', service: 'gastrowallet-backend' });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: 'Database connection failed' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/store', storeRoutes);

const port = Number(process.env.PORT || 5000);
server.listen(port, '0.0.0.0', () => {
  console.log(`GastroWallet backend listening on port ${port}`);
});