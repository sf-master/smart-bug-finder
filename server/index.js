import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import scanRoute from './routes/scanRoute.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

app.use(
    cors({
      origin: "http://localhost:5173",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    })
  );
  
app.use(bodyParser.json({ limit: '2mb' }));
app.use('/api', scanRoute);

app.get('/', (req, res) => {
  res.json({
    message: 'Smart Bug Finder API Server',
    status: 'running',
    version: '0.0.1',
    endpoints: {
      health: '/health',
      scan: '/api/scan',
      analyzeUrl: '/api/analyze-url'
    },
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
  

