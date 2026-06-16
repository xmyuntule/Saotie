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
