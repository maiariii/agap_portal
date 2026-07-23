import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import modular routers & controllers
import authRouter from './modules/auth/auth.router.js';
import vacanciesRouter from './modules/vacancies/vacancies.router.js';
import applicationsRouter from './modules/applications/apps.router.js';
import { getPositions } from './modules/vacancies/vacancies.controller.js';
import { authenticateToken } from './middleware/auth.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Custom CORS middleware to ensure reliability on Vercel and local dev
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://agap-portal-web.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000'
  ];
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Mount Modular Endpoints
app.use('/api/auth', authRouter);
app.use('/api/vacancies', vacanciesRouter);
app.use('/api/applications', applicationsRouter);

// Positions endpoint (direct path matching frontend)
app.get('/api/positions', authenticateToken, getPositions);

// Global Error Handler Middleware
app.use(errorHandler);

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;

