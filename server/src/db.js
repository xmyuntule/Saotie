import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'hahasns.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// --- lightweight migrations: add columns that older databases may be missing ---
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('users', 'banned', 'INTEGER DEFAULT 0');
ensureColumn('users', 'title', "TEXT DEFAULT ''");
ensureColumn('posts', 'edited', 'INTEGER DEFAULT 0');
ensureColumn('threads', 'edited', 'INTEGER DEFAULT 0');
ensureColumn('messages', 'type', "TEXT DEFAULT 'text'");
ensureColumn('posts', 'pinned', 'INTEGER DEFAULT 0');
ensureColumn('users', 'avatar_frame', "TEXT DEFAULT ''");
ensureColumn('orders', 'used', 'INTEGER DEFAULT 0'); // consumable items (改名卡/置顶卡) track usage
ensureColumn('posts', 'global_pin_until', "TEXT DEFAULT ''"); // 全站置顶卡 floats a post to the feed top until this time

// User feedback / bug reports (问题反馈板块)
db.exec(`CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  reply TEXT DEFAULT '',
  replied_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);
ensureColumn('feedback', 'reply', "TEXT DEFAULT ''");
ensureColumn('feedback', 'replied_at', 'TEXT');

// 资讯快报 / 公告（portal-style news feed）
db.exec(`CREATE TABLE IF NOT EXISTS flash (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  category TEXT DEFAULT '动态',
  url TEXT DEFAULT '',
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// 圈子 / 兴趣社群（circles）— users create & join; posts can belong to a circle
db.exec(`CREATE TABLE IF NOT EXISTS circles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT DEFAULT '',
  category TEXT DEFAULT '兴趣',
  color TEXT DEFAULT '',
  icon TEXT DEFAULT 'circle',
  cover TEXT DEFAULT '',
  owner_id INTEGER,
  member_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS circle_members (
  circle_id INTEGER NOT NULL,
  user_id   INTEGER NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (circle_id, user_id)
)`);
ensureColumn('posts', 'circle_id', 'INTEGER');
db.exec('CREATE INDEX IF NOT EXISTS idx_posts_circle ON posts(circle_id)');
ensureColumn('likes', 'reaction', "TEXT DEFAULT 'like'"); // 表情回应: existing likes become the 'like' reaction
ensureColumn('users', 'best_checkin_streak', 'INTEGER DEFAULT 0'); // longest 连续签到 ever (for 签到中心)
ensureColumn('users', 'email', "TEXT DEFAULT ''");            // 注册邮箱（可选，用于邮箱验证/找回）
ensureColumn('users', 'email_verified', 'INTEGER DEFAULT 0'); // 邮箱是否已验证
// backfill best from the current streak so established streakers don't show 0 (idempotent)
db.prepare('UPDATE users SET best_checkin_streak = checkin_streak WHERE best_checkin_streak < checkin_streak').run();
ensureColumn('comments', 'article_id', 'INTEGER'); // comments are polymorphic: post / thread / article
ensureColumn('comments', 'edited', 'INTEGER DEFAULT 0'); // inline comment editing
db.exec('CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id)');

// 投票（polls）— a post may carry one poll with 2-6 options
db.exec(`CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  multi INTEGER DEFAULT 0,
  deadline TEXT,
  total_votes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS poll_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  votes INTEGER DEFAULT 0,
  idx INTEGER DEFAULT 0
)`);
db.exec(`CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id INTEGER NOT NULL,
  option_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (poll_id, option_id, user_id)
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_polls_post ON polls(post_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_poll_votes_lookup ON poll_votes(poll_id, user_id)');

// 问答 / 悬赏求助（Q&A）— questions + answers with optional 积分 bounty
db.exec(`CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  category TEXT DEFAULT '综合',
  bounty INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  best_answer_id INTEGER,
  answer_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  accepted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS answer_votes (
  answer_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (answer_id, user_id)
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status, created_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id)');

// 幸运抽奖（九宫格 lucky draw）— prizes + draw history
db.exec(`CREATE TABLE IF NOT EXISTS lottery_prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT DEFAULT '',
  icon TEXT DEFAULT 'gift',
  color TEXT DEFAULT '',
  weight INTEGER DEFAULT 10,
  position INTEGER DEFAULT 0
)`);
db.exec(`CREATE TABLE IF NOT EXISTS lottery_draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  prize_id INTEGER NOT NULL,
  prize_name TEXT DEFAULT '',
  prize_type TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_lottery_draws_user ON lottery_draws(user_id, created_at)');

// 签到中心（daily check-in log — one row per user per day, powers the calendar + 补签）
db.exec(`CREATE TABLE IF NOT EXISTS checkin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  makeup INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_checkin_user_date ON checkin_log(user_id, date)');

// 专栏 / 长文（long-form articles — a reading channel alongside the short-form feed）
db.exec(`CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  content TEXT NOT NULL,
  category TEXT DEFAULT '综合',
  featured INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_articles_cat ON articles(category, created_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id)');

// 活动 / 活动报名（community events — signups, capacity, online/offline）
db.exec(`CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  cover TEXT DEFAULT '',
  description TEXT DEFAULT '',
  location TEXT DEFAULT '',
  category TEXT DEFAULT '聚会',
  start_at TEXT NOT NULL,
  end_at TEXT DEFAULT '',
  capacity INTEGER DEFAULT 0,
  fee INTEGER DEFAULT 0,
  online INTEGER DEFAULT 0,
  signup_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS event_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(event_id, user_id)
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_event_signups ON event_signups(event_id)');

// 积分红包（point red packets attached to a post — split into shares, grabbed first-come）
db.exec(`CREATE TABLE IF NOT EXISTS red_packets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  remaining_points INTEGER NOT NULL,
  remaining_count INTEGER NOT NULL,
  blessing TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS red_packet_grabs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  packet_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(packet_id, user_id)
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_redpacket_post ON red_packets(post_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_redpacket_grabs ON red_packet_grabs(packet_id)');

// AI 助手对话（integrated AI assistant — conversations + messages）
db.exec(`CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT DEFAULT '新对话',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations(user_id, updated_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id)');

// 导航 / 网址导航（resource directory）— admin-curated categorized links
db.exec(`CREATE TABLE IF NOT EXISTS nav_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'compass',
  position INTEGER DEFAULT 0
)`);
db.exec(`CREATE TABLE IF NOT EXISTS nav_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '',
  clicks INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_nav_links_cat ON nav_links(category_id)');

// 成就勋章 + 任务领取记录（achievements）
db.exec(`CREATE TABLE IF NOT EXISTS user_badges (
  user_id INTEGER NOT NULL,
  badge_key TEXT NOT NULL,
  unlocked_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, badge_key)
)`);
db.exec(`CREATE TABLE IF NOT EXISTS task_claims (
  user_id INTEGER NOT NULL,
  task_key TEXT NOT NULL,
  ymd TEXT NOT NULL,
  claimed_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, task_key, ymd)
)`);

// Topic follows — mirrors board_follows
db.exec(`CREATE TABLE IF NOT EXISTS topic_follows (
  user_id  INTEGER NOT NULL,
  topic_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, topic_id)
)`);

// Per-viewer conversation preferences (pin to top / mute notifications)
db.exec(`CREATE TABLE IF NOT EXISTS conversation_settings (
  user_id INTEGER NOT NULL,
  peer_id INTEGER NOT NULL,
  pinned INTEGER DEFAULT 0,
  muted INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, peer_id)
)`);

// Admin audit log (管理操作日志) — every privileged write is recorded here
db.exec(`CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT DEFAULT '',
  target_id INTEGER,
  detail TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at)');

// Paid-board access (付费板块) — one row per (user, board) once unlocked with points
db.exec(`CREATE TABLE IF NOT EXISTS board_purchases (
  user_id INTEGER NOT NULL,
  board_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, board_id)
)`);

// Browse history / 足迹 — one row per (user, content) with the latest view time (upserted)
db.exec(`CREATE TABLE IF NOT EXISTS view_history (
  user_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  viewed_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, target_type, target_id)
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_view_history_user ON view_history(user_id, viewed_at)');

// Site-wide announcements / broadcast (运营公告) — shown as a dismissible banner
db.exec(`CREATE TABLE IF NOT EXISTS site_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  level TEXT DEFAULT 'info',
  link TEXT DEFAULT '',
  link_label TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  pinned INTEGER DEFAULT 0,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)`);

// 站点配置 / site config (key-value) — 安全限流阈值、模块开关、审核开关等都存这里，后台可改
db.exec(`CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT
)`);
{
  const seedCfg = db.prepare('INSERT OR IGNORE INTO site_config (key, value) VALUES (?,?)');
  [
    ['rate_limit_enabled', '1'],   // 总开关：发帖/私信频率限制
    ['rate_post_per_min', '5'],    // 每分钟最多发几条动态
    ['rate_post_per_hour', '80'],  // 每小时最多发几条动态
    ['rate_thread_per_min', '3'],  // 每分钟最多发几个帖子
    ['rate_dm_per_min', '20'],     // 每分钟最多发几条私信
    // 防批量注册 (A4)
    ['anti_bulk_reg_enabled', '1'], // 总开关：防批量注册
    ['reg_ip_max_per_day', '5'],    // 同一 IP 每天最多注册几个账号
    ['reg_min_interval_sec', '30'], // 同一 IP 两次注册的最小间隔（秒）
    // 邮箱验证注册 (A2) —— 默认关闭，需配置 SMTP 后由后台开启
    ['require_email_verify', '0'],  // 注册是否强制邮箱验证
    ['email_verify_enabled', '0'],  // 邮箱验证码功能是否可用（需 SMTP）
    // 接口权限门控 (V) —— 按等级/VIP 门控各动作；默认全 0 = 不门控，后台可开
    ['perm_enabled', '0'],          // 权限门控总开关
    ['perm_comment_min_level', '0'], ['perm_comment_require_vip', '0'], // 评论
    ['perm_dm_min_level', '0'],      ['perm_dm_require_vip', '0'],      // 私信
    ['perm_upload_min_level', '0'],  ['perm_upload_require_vip', '0'],  // 上传图片/视频
    ['perm_post_min_level', '0'],    ['perm_post_require_vip', '0'],    // 发动态
    ['perm_thread_min_level', '0'],  ['perm_thread_require_vip', '0'],  // 发帖
  ].forEach(([k, v]) => seedCfg.run(k, v));
}

// 注册日志（防批量注册按 IP 统计）
db.exec(`CREATE TABLE IF NOT EXISTS reg_log (
  id INTEGER PRIMARY KEY,
  ip TEXT,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_reg_log_ip ON reg_log(ip, created_at)`);

// 邮箱验证码（A2，10 分钟有效）
db.exec(`CREATE TABLE IF NOT EXISTS email_verify_codes (
  id INTEGER PRIMARY KEY,
  email TEXT,
  code TEXT,
  ip TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);

// Indexes — keep the feed/profile/notification queries fast at 1k users / 10k posts scale
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
  CREATE INDEX IF NOT EXISTS idx_posts_topic ON posts(topic_id);
  CREATE INDEX IF NOT EXISTS idx_posts_vis ON posts(visibility);
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);
  CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_type, target_id);
  CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
  CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
  CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
`);

export default db;
