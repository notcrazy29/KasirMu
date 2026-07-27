import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cron from 'node-cron';
import apiRouter from './routes';
import { errorHandler } from './middlewares/error';
import { initSocket } from './services/socket';
import { expireSubscriptions, processGracePeriodExpirations, runSubscriptionReminderChecks } from './services/subscription';

// Load environmental parameters
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })
);

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // relaxed for dev testing and automated checks
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' },
});

// App Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiter to APIs
app.use('/api/', limiter);

// Register API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Real-time synchronization bootstrapper
initSocket(server);

// ─────────────────────────────────────────────────────────────────────────────
// Cron Jobs — Subscription Lifecycle Management
// ─────────────────────────────────────────────────────────────────────────────

// Every minute: expire check (ACTIVE → GRACE_PERIOD) + grace period check (GRACE_PERIOD → FREE)
cron.schedule('* * * * *', async () => {
  try {
    const toGrace = await expireSubscriptions();
    if (toGrace > 0) {
      console.log(`[Cron/1min] ${toGrace} subscription(s) moved to GRACE_PERIOD`);
    }
  } catch (err) {
    console.error('[Cron/1min] Subscription expiry check failed:', err);
  }

  try {
    const downgraded = await processGracePeriodExpirations();
    if (downgraded > 0) {
      console.log(`[Cron/1min] ${downgraded} subscription(s) downgraded to FREE`);
    }
  } catch (err) {
    console.error('[Cron/1min] Grace period expiry check failed:', err);
  }
});

// Every hour: full sweep — expire + send multi-threshold reminders (7, 3, 1 day)
cron.schedule('0 * * * *', async () => {
  console.log('[Cron/1hr] Running full subscription lifecycle check...');
  try {
    await expireSubscriptions();
    await runSubscriptionReminderChecks();
  } catch (err) {
    console.error('[Cron/1hr] Subscription expiry/reminder check failed:', err);
  }
});

// Every day at 08:00 WIB (01:00 UTC): full daily reminder sweep
cron.schedule('0 1 * * *', async () => {
  console.log('[Cron] Running daily subscription reminder sweep...');
  try {
    await runSubscriptionReminderChecks();
  } catch (err) {
    console.error('[Cron] Daily reminder sweep failed:', err);
  }
});

console.log('[Cron] Subscription lifecycle scheduler initialized');

// Global Error Handler
app.use(errorHandler);

// Start listening
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`  KasirMu Engine running on port ${PORT}`);
  console.log(`  Realtime WebSockets ready`);
  console.log(`=========================================`);
});
