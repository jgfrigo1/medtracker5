// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// IMPORTANT: CORS Configuration
// Only allow requests from your deployed frontend URL
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Fallback for local dev
};
app.use(cors(corsOptions));
app.use(express.json()); // Middleware to parse JSON bodies

// A simple test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running!' });
});

// TODO: Add your Telegram bot logic here in the future.

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});