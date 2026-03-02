require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./src/config/db');

connectDB();

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps) or any localhost port
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth',    require('./src/routes/auth'));
app.use('/api/clients', require('./src/routes/clients'));
app.use('/api/galleries', require('./src/routes/galleries'));
app.use('/api/galleries/:galleryId/images', require('./src/routes/images'));
app.use('/api/galleries/:galleryId', require('./src/routes/selections'));
app.use('/api/blog',    require('./src/routes/blog'));
app.use('/api/contact', require('./src/routes/contact'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Koral API running on port ${PORT}`));
