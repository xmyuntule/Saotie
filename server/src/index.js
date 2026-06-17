import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { optionalAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';
import forumRoutes from './routes/forum.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import topicRoutes from './routes/topics.js';
import uploadRoutes from './routes/upload.js';
import searchRoutes from './routes/search.js';
import adminRoutes from './routes/admin.js';
import mallRoutes from './routes/mall.js';
import reportRoutes from './routes/reports.js';
import feedbackRoutes from './routes/feedback.js';
import flashRoutes from './routes/flash.js';
import circleRoutes from './routes/circles.js';
import qaRoutes from './routes/qa.js';
import achievementRoutes from './routes/achievements.js';
import navRoutes from './routes/nav.js';
import aiRoutes from './routes/ai.js';
import lotteryRoutes from './routes/lottery.js';
import checkinRoutes from './routes/checkin.js';
import articleRoutes from './routes/articles.js';
import eventRoutes from './routes/events.js';
import noticeRoutes from './routes/notices.js';
import historyRoutes from './routes/history.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(optionalAuth);

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mall', mallRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/flash', flashRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/nav', navRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/lottery', lotteryRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/history', historyRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'HahaSNS' }));

// Serve built client in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler (e.g. multer file-type / size errors)
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(400).json({ error: err.message || '服务器错误' });
});

app.listen(PORT, () => {
  console.log(`HahaSNS API running on http://localhost:${PORT}`);
});
