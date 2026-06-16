-- HahaSNS database schema (lightweight social + forum + community)
PRAGMA foreign_keys = ON;

-- ---------- Users / Member Center ----------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,          -- login handle
  nickname      TEXT NOT NULL,                 -- display name
  password_hash TEXT NOT NULL,
  email         TEXT,
  avatar        TEXT,                          -- /uploads/... or null
  cover         TEXT,                          -- profile cover image
  bio           TEXT DEFAULT '',               -- signature
  gender        TEXT DEFAULT 'secret',         -- male | female | secret
  location      TEXT DEFAULT '',               -- city
  verified      INTEGER DEFAULT 0,             -- V certification (0/1)
  verified_note TEXT DEFAULT '',               -- e.g. "知名设计师"
  vip           INTEGER DEFAULT 0,             -- VIP membership (0/1)
  vip_expires   TEXT,                          -- ISO date
  role          TEXT DEFAULT 'user',           -- user | admin
  banned        INTEGER DEFAULT 0,             -- account disabled by admin
  title         TEXT DEFAULT '',               -- equipped title from mall (头衔)
  points        INTEGER DEFAULT 0,             -- 积分
  experience    INTEGER DEFAULT 0,             -- 经验 (drives level)
  balance       INTEGER DEFAULT 0,             -- 余额 (recharge wallet, cents)
  checkin_streak INTEGER DEFAULT 0,            -- consecutive sign-in days
  last_checkin  TEXT,                          -- YYYY-MM-DD
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ---------- Follow graph ----------
CREATE TABLE IF NOT EXISTS follows (
  follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, following_id)
);

-- ---------- Posts / 动态 (SNS feed) ----------
CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT DEFAULT '',
  media       TEXT DEFAULT '[]',               -- JSON array of {type,url} (image/video/music)
  media_type  TEXT DEFAULT 'text',             -- text | image | video | music
  visibility  TEXT DEFAULT 'public',           -- public | private | password | paid | anonymous
  password    TEXT,                            -- for password posts
  price        INTEGER DEFAULT 0,              -- for paid posts (points)
  location    TEXT DEFAULT '',
  device      TEXT DEFAULT '电脑端',            -- 手机端 | 电脑端
  topic_id    INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  share_of    INTEGER REFERENCES posts(id) ON DELETE SET NULL,  -- shared/repost source
  views       INTEGER DEFAULT 0,
  like_count  INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  edited      INTEGER DEFAULT 0,
  pinned      INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------- Comments (nested) ----------
CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id     INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  thread_id   INTEGER REFERENCES threads(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  reply_to    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  like_count  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------- Likes (polymorphic: post | comment | thread) ----------
CREATE TABLE IF NOT EXISTS likes (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,                   -- post | comment | thread
  target_id   INTEGER NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, target_type, target_id)
);

-- ---------- Paid post purchases ----------
CREATE TABLE IF NOT EXISTS purchases (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, post_id)
);

-- ---------- Topics / 话题 (hashtags) ----------
CREATE TABLE IF NOT EXISTS topics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  cover       TEXT,
  post_count  INTEGER DEFAULT 0,
  hot         INTEGER DEFAULT 0,               -- trending weight
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------- Forum boards / 板块 ----------
CREATE TABLE IF NOT EXISTS boards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id   INTEGER REFERENCES boards(id) ON DELETE CASCADE,  -- sub-boards
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  cover       TEXT,
  icon        TEXT,                            -- emoji / icon
  announcement TEXT DEFAULT '',
  is_paid     INTEGER DEFAULT 0,
  price       INTEGER DEFAULT 0,
  thread_count INTEGER DEFAULT 0,
  sort        INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------- Board subscriptions / 关注板块 ----------
CREATE TABLE IF NOT EXISTS board_follows (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_id   INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, board_id)
);

-- ---------- Board moderators / 版主 ----------
CREATE TABLE IF NOT EXISTS moderators (
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (board_id, user_id)
);

-- ---------- Forum threads / 帖子 ----------
CREATE TABLE IF NOT EXISTS threads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id    INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  media       TEXT DEFAULT '[]',
  pinned      INTEGER DEFAULT 0,               -- 置顶
  elite       INTEGER DEFAULT 0,               -- 精华
  locked      INTEGER DEFAULT 0,
  views       INTEGER DEFAULT 0,
  like_count  INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  edited      INTEGER DEFAULT 0,
  last_reply_at TEXT DEFAULT (datetime('now')),
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------- Private messages / 私信 ----------
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  type        TEXT DEFAULT 'text',             -- text | image
  read        INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------- Notifications / 通知 ----------
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- recipient
  actor_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,           -- who triggered
  type        TEXT NOT NULL,                   -- follow | like | comment | reply | mention | reward | system
  target_type TEXT,                            -- post | comment | thread | user
  target_id   INTEGER,
  preview     TEXT DEFAULT '',
  read        INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------- Reward / 打赏 records ----------
CREATE TABLE IF NOT EXISTS rewards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  amount      INTEGER NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------- Bookmarks / 收藏 ----------
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, post_id)
);

-- ---------- Block list / 拉黑 ----------
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- ---------- Reports / 举报 ----------
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,                   -- post | thread | comment | user
  target_id   INTEGER NOT NULL,
  reason      TEXT DEFAULT '',
  status      TEXT DEFAULT 'open',             -- open | resolved
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ---------- Points mall / 积分商城 ----------
CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon        TEXT DEFAULT '🎁',               -- emoji
  category    TEXT DEFAULT 'item',             -- title | frame | item | physical
  payload     TEXT DEFAULT '',                 -- e.g. the title text granted
  price       INTEGER NOT NULL,                -- in points
  stock       INTEGER DEFAULT -1,              -- -1 = unlimited
  sold        INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price       INTEGER NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_threads_board ON threads(board_id);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
