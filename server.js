// backend/server.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const habitRoutes = require('./routes/habitRoutes');   // ← ADD

dotenv.config();
connectDB();

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',          // Vite dev
    'https://your-app.vercel.app'     // production (add after deploy)
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// ─── Mount Routes ──────────────────────────────────────────────
app.use('/api/habits', habitRoutes);
// ANY request starting with /api/habits → handled by habitRoutes
//
// So inside habitRoutes, '/' means '/api/habits'
// And '/:id/complete' means '/api/habits/:id/complete'
// This prefix system keeps routes organized

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Habit Tracker API is running!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});