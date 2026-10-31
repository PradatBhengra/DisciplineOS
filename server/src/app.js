const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Behind a proxy like Render set TRUST_PROXY=1, otherwise every request has the
// proxy's IP and all users share one rate limit bucket
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

app.use(helmet({ contentSecurityPolicy: false })); // CSP off so Google Fonts + inline handlers work
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/data', require('./routes/dataRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/marks', require('./routes/markRoutes'));
app.use('/api/todos', require('./routes/todoRoutes'));
app.use('/api/habits', require('./routes/habitRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Serve the frontend
const clientDir = path.join(__dirname, '../../client');
app.use(express.static(clientDir));
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDir, 'index.html')));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
