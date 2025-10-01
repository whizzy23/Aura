require('dotenv').config();
const express = require('express');
const cors = require('cors');
const interviewRoutes = require('./routes/interview');
const transcribeRoutes = require('./routes/transcribe');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.send('Server is up.');
});

// Routes
app.use('/api', interviewRoutes);
app.use('/api', transcribeRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});