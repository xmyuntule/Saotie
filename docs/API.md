# HahaSNS REST API Reference

HahaSNS is an Express + better-sqlite3 social network backend. This document covers every HTTP endpoint exposed under the API base path.

## Conventions

- **Base URL:** `/api` — every path below is mounted under it (e.g. `POST /api/auth/login`).
- **Content type:** JSON throughout. Request bodies are JSON (`Content-Type: application/json`); the only exception is `POST /api/upload`, which takes `multipart/form-data`. Responses are JSON.
- **Auth scheme:** `Authorization: Bearer <JWT>`. Obtain a token from `POST /api/auth/register` or `POST /api/auth/login` (the token lives 30 days). Send it on every request that needs identity.
- **Auth tags used below:**
  - **Public** — no token required (a token, if present, may personalize the response, e.g. `liked`/`isFollowing` flags).
  - **Auth** — a valid token is required; otherwise `401 { "error": "请先登录" }`.
  - **Admin** — requires a valid token whose user has `role === 'admin'`; otherwise `403`. Some modules gate inline (`req.user.role !== 'admin'`); the `admin` module gates its whole router via `requireAuth` + `requireAdmin`.
- **User object:** Endpoints returning a user emit a `publicUser` shape: `id, username, nickname, avatar, cover, bio, gender, location, verified, verifiedNote, vip, role, banned, title, avatarFrame, points, experience, balance, level, levelProgress, checkinStreak, lastCheckin, createdAt, followers, following, postCount, isFollowing`. The password hash is never exposed.
- **Errors:** Non-2xx responses are `{ "error": "<message>" }` (messages are in Chinese). Common codes: `400` invalid input, `401` not logged in, `402` insufficient points, `403` forbidden, `404` not found, `409` conflict.
- **Health check:** `GET /api/health` → `{ ok: true, app: "HahaSNS" }` (Public).
- **Static files:** uploaded media is served from `/uploads/<filename>` (outside `/api`).

## Table of Contents

- [Auth](#auth) — `/api/auth`
- [Users](#users) — `/api/users`
- [Posts](#posts) — `/api/posts`
- [Comments](#comments) — `/api/comments`
- [Forum](#forum) — `/api/forum`
- [Messages](#messages) — `/api/messages`
- [Notifications](#notifications) — `/api/notifications`
- [Topics](#topics) — `/api/topics`
- [Upload](#upload) — `/api/upload`
- [Search](#search) — `/api/search`
- [Admin](#admin) — `/api/admin`
- [Mall](#mall) — `/api/mall`
- [Reports](#reports) — `/api/reports`
- [Feedback](#feedback) — `/api/feedback`
- [Flash](#flash) — `/api/flash`
- [Circles](#circles) — `/api/circles`
- [Q&A](#qa) — `/api/qa`
- [Achievements](#achievements) — `/api/achievements`
- [Nav](#nav) — `/api/nav`

---

## Auth

User accounts, sessions, sign-in, and account-card actions.

### `POST /api/auth/register`
Create an account and return a session token. **Auth:** Public.
- Body: `username` (required, 2–20 chars of letters/digits/underscore/Chinese), `password` (required, ≥6 chars), `nickname` (optional, defaults to username).
- Response: `{ token, user }`. Existing username → `409`.

### `POST /api/auth/login`
Authenticate and return a session token. **Auth:** Public.
- Body: `username`, `password`.
- Response: `{ token, user }`. Wrong credentials → `401`; banned accounts → `403`.

### `GET /api/auth/me`
Return the current authenticated user. **Auth:** Auth.
- Response: `{ user }`.

### `POST /api/auth/password`
Change the account password. **Auth:** Auth.
- Body: `oldPassword`, `newPassword` (≥6 chars).
- Response: `{ ok: true }`.

### `POST /api/auth/checkin`
Daily sign-in / 签到 (awards points + experience; tracks streak). **Auth:** Auth.
- Body: none.
- Response: `{ ok: true, streak, pointsEarned, expEarned, user }`. Already checked in today → `400`.

### `POST /api/auth/change-username`
Rename the account, consuming one unused 改名卡 (mall item with payload `rename`). **Auth:** Auth.
- Body: `username` (new handle, same charset rules as register).
- Response: `{ ok: true, user }`. No rename card → `403`; name taken → `409`.

---

## Users

Profiles, follow/block graph, leaderboards, wallet.

### `GET /api/users/mention`
@-mention autocomplete lookup. **Auth:** Public.
- Query: `q` (prefix/substring).
- Response: `{ users: [...] }` (up to 6).

### `GET /api/users/me/bookmarks`
The viewer's bookmarked posts / 我的收藏. **Auth:** Auth.
- Response: `{ posts: [...] }`.

### `POST /api/users/:id/block`
Toggle block on a user (also removes mutual follows). **Auth:** Auth.
- Response: `{ blocked: true|false }`. Cannot block self (`400`).

### `GET /api/users/me/blocks`
The viewer's block list / 黑名单. **Auth:** Auth.
- Response: `{ users: [...] }`.

### `GET /api/users/:id/blocked`
Whether the viewer is blocking the given user. **Auth:** Auth.
- Response: `{ blocked }`.

### `GET /api/users/ranking/checkin`
Check-in streak leaderboard (top 10). **Auth:** Public.
- Response: `{ users: [...] }`.

### `GET /api/users/ranking/:type`
Leaderboard by `type`: `wealth` (财富/points), `level` (等级/experience), `fans` (人气/followers), `checkin` (签到). **Auth:** Public.
- Response: `{ users: [...] }` (top 50). Unknown type → `400`.

### `GET /api/users/suggestions`
Suggested users to follow (not yet followed). **Auth:** Public.
- Response: `{ users: [...] }` (up to 6).

### `GET /api/users/:username`
Profile by username (falls back to nickname). **Auth:** Public.
- Response: `{ user }`. Unknown → `404`.

### `GET /api/users/:username/:rel`
Follower / following list, where `:rel` is `followers` or `following`. **Auth:** Public.
- Response: `{ users: [...] }`.

### `POST /api/users/:id/follow`
Toggle follow/unfollow a user. **Auth:** Auth.
- Response: `{ following: true|false, user }`. Cannot follow self (`400`).

### `PUT /api/users/me/profile`
Update own profile. **Auth:** Auth.
- Body (all optional, COALESCE-merged): `nickname`, `bio`, `gender`, `location`, `avatar`, `cover`, `verifiedNote`.
- Response: `{ user }`.

### `POST /api/users/me/recharge`
Demo wallet recharge; optionally activate/extend VIP. **Auth:** Auth.
- Body: `amount` (0–100000), `vip` (boolean — adds one month of VIP).
- Response: `{ user }`.

---

## Posts

Feed, single posts, polls, likes, shares, paid/password unlock, rewards, pins, bookmarks.

### `GET /api/posts`
Paginated feed. **Auth:** Public (personalized when authed).
- Query: `filter` (`all` default, `following`, `video`, `samecity`, `recommend`), `limit` (1–30, default 12), `offset`.
- Response: `{ posts: [...], hasMore }`. Blocked users are filtered out.

### `GET /api/posts/:id`
Single post (increments view count). **Auth:** Public.
- Response: `{ post }`. Private post not owned → `403`; missing → `404`.

### `GET /api/posts/:id/related`
Related posts (same topic, then same author). **Auth:** Public.
- Response: `{ posts: [...] }` (up to 5).

### `GET /api/posts/:id/siblings`
Previous/next post by the same author (timeline nav). **Auth:** Public.
- Response: `{ prev, next }` (each `{ id, content }` or `null`).

### `POST /api/posts`
Create a post. **Auth:** Auth.
- Body: `content`, `media` (array), `mediaType` (`text`/`image`/`video`, default `text`), `visibility` (`public`/`paid`/`password`/`private`/`anonymous`), `password` (for password posts), `price` (for paid posts), `location`, `device` (default `电脑端`), `topic` (name; also parsed from `#...#` in content), `circleId` (must be a circle the user joined), `poll` (`{ options: [], multi, days }`; 2–6 options).
- Response: `{ post }`.

### `POST /api/posts/:id/vote`
Vote on the post's attached poll. **Auth:** Auth.
- Body: `optionIds` (array) or `optionId` (single). Single-choice polls use the first.
- Response: `{ poll }`. Errors if no poll (`404`), poll closed, already voted, or no valid selection (`400`).

### `POST /api/posts/:id/share`
Share / repost a post. **Auth:** Auth.
- Body: `content` (optional comment).
- Response: `{ post }` (the new share post).

### `POST /api/posts/:id/like`
Toggle like on a post. **Auth:** Auth.
- Response: `{ liked, likeCount }`.

### `POST /api/posts/:id/unlock`
Unlock a paid post (spends points) or verify a password post. **Auth:** Auth.
- Body: `password` (for password posts).
- Response: `{ post }` (paid), or `{ post, bypass: true, content, media }` (password). `402` insufficient points; `403` wrong password.

### `POST /api/posts/:id/reward`
Tip / 打赏 the post author with points. **Auth:** Auth.
- Body: `amount` (1–9999).
- Response: `{ ok: true }`. `402` insufficient points; cannot reward self (`400`).

### `PUT /api/posts/:id`
Edit own post. **Auth:** Auth (owner).
- Body (optional): `content`, `media`, `visibility`, `price`.
- Response: `{ post }`. Not owner → `403`.

### `POST /api/posts/:id/pin`
Toggle pin on own post (only one pinned per user). **Auth:** Auth (owner).
- Response: `{ pinned }`.

### `POST /api/posts/:id/global-pin`
Toggle site-wide pin / 全站置顶 for 24h, consuming a 全站置顶卡 (payload `pin`). **Auth:** Auth (owner).
- Response: `{ globalPinned, until }` (or `{ globalPinned: false }` when un-pinning). No pin card → `403`.

### `POST /api/posts/:id/bookmark`
Toggle bookmark / 收藏. **Auth:** Auth.
- Response: `{ bookmarked }`.

### `DELETE /api/posts/:id`
Delete a post. **Auth:** Auth (owner or admin).
- Response: `{ ok: true }`.

### `GET /api/posts/user/:username`
Posts by a user (profile feed, pinned first). **Auth:** Public.
- Response: `{ posts: [...] }`.

### `GET /api/posts/liked/:username`
Posts a user has liked (profile 赞过 tab). **Auth:** Public.
- Response: `{ posts: [...] }`.

---

## Comments

Comments and replies on posts and forum threads.

### `GET /api/comments`
List comments as a nested tree. **Auth:** Public.
- Query: `postId` or `threadId` (one required), `sort` (`latest` default, `hot`).
- Response: `{ comments: [...] }` with nested `replies`.

### `POST /api/comments`
Add a comment or reply. **Auth:** Auth.
- Body: `postId` or `threadId` (one required), `parentId` (optional), `replyTo` (optional user id), `content`.
- Response: `{ comment }`.

### `POST /api/comments/:id/like`
Toggle like on a comment. **Auth:** Auth.
- Response: `{ liked, likeCount }`.

### `DELETE /api/comments/:id`
Delete a comment. **Auth:** Auth (owner or admin).
- Response: `{ ok: true }`.

---

## Forum

Boards, threads, board follows, moderation.

### `GET /api/forum/boards`
List top-level boards with nested children. **Auth:** Public.
- Response: `{ boards: [...] }`.

### `GET /api/forum/my-boards`
Boards the viewer follows. **Auth:** Auth.
- Response: `{ boards: [...] }`.

### `POST /api/forum/boards/:id/follow`
Toggle follow on a board. **Auth:** Auth.
- Response: `{ following }`.

### `GET /api/forum/boards/:slug`
A board plus its threads (and child-board threads). **Auth:** Public.
- Query: `sort` (`latest` default, `hot`, `elite`).
- Response: `{ board, threads: [...] }`.

### `GET /api/forum/threads`
Recent threads across all boards. **Auth:** Public.
- Query: `sort` (`latest` default, `hot`, `elite`).
- Response: `{ threads: [...] }`.

### `GET /api/forum/threads/user/:username`
Threads authored by a user. **Auth:** Public.
- Response: `{ threads: [...] }`.

### `GET /api/forum/threads/:id`
Single thread (increments views, full content). **Auth:** Public.
- Response: `{ thread }`.

### `POST /api/forum/threads`
Create a thread. **Auth:** Auth.
- Body: `boardId`, `title`, `content`, `media` (array, optional).
- Response: `{ thread }`.

### `POST /api/forum/threads/:id/like`
Toggle like on a thread. **Auth:** Auth.
- Response: `{ liked, likeCount }`.

### `PUT /api/forum/threads/:id`
Edit own thread. **Auth:** Auth (owner).
- Body (optional): `title`, `content`.
- Response: `{ thread }`.

### `POST /api/forum/threads/:id/moderate`
Moderate a thread. **Auth:** Auth — `delete` allowed for owner or moderator; `pin`/`elite`/`lock` require a board moderator (admins are moderators everywhere).
- Body: `action` (`pin`, `elite`, `lock`, `delete`).
- Response: `{ ok: true, deleted: true }` or `{ ok: true, <pinned|elite|locked>: bool }`.

---

## Messages

Private one-to-one direct messages.

### `GET /api/messages`
Conversation list (latest message + unread count per peer, pinned first). **Auth:** Auth.
- Response: `{ conversations: [...] }` — each `{ peer, last, unread, pinned, muted }`.

### `GET /api/messages/unread`
Total unread DM count for the navbar badge (muted peers excluded). **Auth:** Auth.
- Response: `{ unread }`.

### `POST /api/messages/:peerId/settings`
Set per-conversation pin / mute preferences. **Auth:** Auth.
- Body: `pinned` (boolean), `muted` (boolean) — either optional.
- Response: `{ pinned, muted }`.

### `GET /api/messages/:peerId`
Conversation thread with a peer (marks incoming messages read). **Auth:** Auth.
- Response: `{ peer, messages: [...] }` (up to 200).

### `DELETE /api/messages/:peerId`
Delete the entire conversation with a peer. **Auth:** Auth.
- Response: `{ ok: true }`.

### `POST /api/messages/:peerId`
Send a message. **Auth:** Auth.
- Body: `content`, `type` (`text` default, `image`).
- Response: `{ message }`. Peer missing → `404`.

---

## Notifications

In-app notification inbox.

### `GET /api/notifications`
List notifications (newest first, up to 100). **Auth:** Auth.
- Response: `{ notifications: [...] }` — each `{ id, type, targetType, targetId, preview, read, createdAt, actor }`.

### `GET /api/notifications/unread`
Unread notification count. **Auth:** Auth.
- Response: `{ unread }`.

### `POST /api/notifications/read`
Mark all notifications read. **Auth:** Auth.
- Response: `{ ok: true }`.

### `POST /api/notifications/:id/read`
Mark a single notification read. **Auth:** Auth.
- Response: `{ ok: true }`.

---

## Topics

Hashtag topics and topic follows.

### `GET /api/topics`
Hot topics, or `?q=` search for autocomplete. **Auth:** Public.
- Query: `q` (optional).
- Response: `{ topics: [...] }`.

### `GET /api/topics/following`
Topics the viewer follows. **Auth:** Auth.
- Response: `{ topics: [...] }`.

### `GET /api/topics/:name`
A topic plus its posts. **Auth:** Public.
- Response: `{ topic, posts: [...] }`. Unknown topic → `404`.

### `POST /api/topics/:name/follow`
Toggle follow on a topic. **Auth:** Auth.
- Response: `{ following }`.

---

## Upload

Media upload for posts, threads, messages, and avatars.

### `POST /api/upload`
Upload up to 9 files. **Auth:** Auth. **Content type:** `multipart/form-data`.
- Form field: `files` (up to 9; image/video/audio only; max 25 MB each).
- Response: `{ files: [{ url, type, name }] }` (`type` is `image`/`video`/`audio`; `url` like `/uploads/<filename>`).

---

## Search

Global and trending search.

### `GET /api/search/trending`
Trending keywords (derived from hot topics). **Auth:** Public.
- Response: `{ keywords: [...] }`.

### `GET /api/search`
Global search across users, posts, threads, topics. **Auth:** Public.
- Query: `q`.
- Response: `{ users: [...], posts: [...], threads: [...], topics: [...] }`. Empty `q` returns empty arrays. (`threads` items are `{ id, title, replyCount }`.)

---

## Admin

Site administration. **The entire `/api/admin` router requires Auth + Admin** (`requireAuth` then `requireAdmin`). Every endpoint below is **Admin**.

### `GET /api/admin/overview`
Site stats, last-7-days activity, recent users.
- Response: `{ stats: { users, posts, threads, comments, topics, boards, reports, vip }, activity: [...], recentUsers: [...] }`.

### `GET /api/admin/users`
Search users (response includes `email`). 
- Query: `q`.
- Response: `{ users: [...] }`.

### `PUT /api/admin/users/:id`
Update a user's flags/fields.
- Body (all optional): `verified`, `vip`, `role`, `banned`, `verifiedNote`, `title`, `points`.
- Response: `{ user }`.

### `POST /api/admin/boards`
Create a board.
- Body: `name`, `slug` (both required), `description`, `icon`, `parentId`, `announcement`, `isPaid`, `price`.
- Response: `{ board }`. Duplicate slug → `409`.

### `PUT /api/admin/boards/:id`
Update a board.
- Body (optional): `name`, `description`, `icon`, `announcement`, `isPaid`, `price`, `sort`.
- Response: `{ ok: true }`.

### `DELETE /api/admin/boards/:id`
Delete a board.
- Response: `{ ok: true }`.

### `POST /api/admin/boards/:id/moderators`
Toggle a user as moderator of a board.
- Body: `username` (username or nickname).
- Response: `{ added: true, user }` or `{ added: false }`.

### `POST /api/admin/topics`
Create a topic.
- Body: `name` (required), `description`.
- Response: `{ topic }`. Duplicate → `409`.

### `DELETE /api/admin/topics/:id`
Delete a topic.
- Response: `{ ok: true }`.

### `GET /api/admin/reports`
List open reports with target previews.
- Response: `{ reports: [...] }` — each `{ id, targetType, targetId, reason, createdAt, reporter, target }`.

### `POST /api/admin/reports/:id/resolve`
Mark a report resolved.
- Response: `{ ok: true }`.

### `POST /api/admin/products`
Create a mall product.
- Body: `name`, `price` (both required), `description`, `icon`, `category`, `payload`, `stock` (-1 = unlimited).
- Response: `{ product }`.

### `DELETE /api/admin/products/:id`
Delete a product.
- Response: `{ ok: true }`.

### `DELETE /api/admin/content/:type/:id`
Delete content of `:type` (`post`, `thread`, `comment`).
- Response: `{ ok: true }`. Unknown type → `400`.

---

## Mall

Points store, orders, and inventory.

### `GET /api/mall/products`
List products (cheapest first; `owned`/`soldOut` flags personalized when authed). **Auth:** Public.
- Response: `{ products: [...] }` — each `{ id, name, description, icon, category, payload, price, stock, sold, owned, soldOut }`.

### `GET /api/mall/orders`
The viewer's orders. **Auth:** Auth.
- Response: `{ orders: [...] }`.

### `GET /api/mall/inventory`
Unused consumable items grouped by payload, e.g. `{ rename: 1 }`. **Auth:** Auth.
- Response: `{ inventory }`.

### `POST /api/mall/products/:id/redeem`
Redeem a product with points (equips title/frame immediately for those categories). **Auth:** Auth.
- Response: `{ ok: true, user }`. `402` insufficient points; `400` sold out or already owned (non-`item` categories).

---

## Reports

Submit content/user reports (reviewed in the Admin module).

### `POST /api/reports`
Report a target. **Auth:** Auth.
- Body: `targetType` (`post`, `thread`, `comment`, `user`), `targetId`, `reason` (optional).
- Response: `{ ok: true }`. Invalid type/target → `400`.

---

## Feedback

User feedback board (问题反馈).

### `POST /api/feedback`
Submit feedback. **Auth:** Auth.
- Body: `content` (≥5 chars).
- Response: `{ ok: true, id }`.

### `GET /api/feedback`
List feedback (newest first, up to 100). **Auth:** Public.
- Query: `status` (optional; one of `open`, `planned`, `doing`, `resolved`, `closed`).
- Response: `{ feedback: [...] }` — each `{ id, content, status, reply, repliedAt, createdAt, user }`.

### `POST /api/feedback/:id/reply`
Reply to / set status of a feedback item. **Auth:** Admin (gated inline by `req.user.role !== 'admin'`).
- Body: `reply`, `status` (one of the five statuses; defaults to `resolved`).
- Response: `{ ok: true }`.

---

## Flash

News flash / 资讯快报 ticker.

### `GET /api/flash`
List flash items (pinned first, newest first). **Auth:** Public.
- Query: `limit` (1–50, default 30), `category` (optional filter).
- Response: `{ flash: [...] }` — each `{ id, title, summary, category, url, pinned, createdAt }`.

### `POST /api/flash`
Publish a flash item. **Auth:** Admin (gated inline).
- Body: `title` (required), `summary`, `category` (default `动态`), `url`, `pinned`.
- Response: `{ ok: true, id }`.

---

## Circles

Interest circles / 圈子 — communities users join and post into.

### `GET /api/circles`
List circles. **Auth:** Public (personalized `joined` when authed).
- Query: `sort` (`hot` default, `new`), `category` (optional), `mine` (`1` → only the viewer's joined circles, requires auth).
- Response: `{ circles: [...] }` — each `{ id, name, slug, description, category, color, icon, cover, memberCount, postCount, createdAt, owner, joined }`.

### `GET /api/circles/suggestions`
Suggested active circles the viewer hasn't joined (up to 5). **Auth:** Public.
- Response: `{ circles: [...] }`.

### `GET /api/circles/:slug`
Circle detail by slug or numeric id, with a sample of members. **Auth:** Public.
- Response: `{ circle, members: [...] }` (up to 12 members). Not found → `404`.

### `GET /api/circles/:slug/posts`
Circle feed (pinned first, newest first). **Auth:** Public.
- Query: `limit` (1–30, default 20), `offset`.
- Response: `{ posts: [...] }`.

### `POST /api/circles`
Create a circle (creator becomes owner + first member). **Auth:** Auth.
- Body: `name` (required, ≤24 chars), `description` (≤200), `category` (default `兴趣`), `color`, `icon` (default `circle`).
- Response: `{ circle }`.

### `POST /api/circles/:id/join`
Join a circle. **Auth:** Auth.
- Response: `{ joined: true, memberCount }`.

### `POST /api/circles/:id/leave`
Leave a circle. **Auth:** Auth.
- Response: `{ joined: false, memberCount }`. The owner cannot leave (`400`).

---

## Q&A

Question-and-answer board with point bounties / 问答悬赏.

### `GET /api/qa`
List questions. **Auth:** Public.
- Query: `status` (`open`, `solved`), `category` (or `全部`), `sort` (`new` default, `hot`, `bounty`).
- Response: `{ questions: [...] }` — each `{ id, title, excerpt, category, bounty, status, bestAnswerId, answerCount, viewCount, createdAt, isAsker, author }`.

### `GET /api/qa/spotlight`
A few open, high-bounty questions for the sidebar (up to 5). **Auth:** Public.
- Response: `{ questions: [...] }`.

### `GET /api/qa/:id`
Question detail (increments views) with answers (accepted first, then by votes). **Auth:** Public.
- Response: `{ question, answers: [...] }`. Question includes full `body`; answers are `{ id, content, voteCount, accepted, createdAt, voted, author }`.

### `POST /api/qa`
Ask a question; bounty (if any) is escrowed from the asker's points. **Auth:** Auth.
- Body: `title` (required, ≤60 chars), `body` (≤2000), `category` (default `综合`), `bounty` (0–9999).
- Response: `{ question }`. `402` if insufficient points for the bounty.

### `POST /api/qa/:id/answers`
Answer a question. **Auth:** Auth.
- Body: `content` (≤2000).
- Response: `{ answer }`.

### `POST /api/qa/answers/:id/vote`
Toggle an upvote on an answer. **Auth:** Auth.
- Response: `{ voted, voteCount }`.

### `POST /api/qa/:id/accept/:answerId`
Accept an answer (asker only) — transfers the bounty to the answerer and marks the question solved. **Auth:** Auth (asker).
- Response: `{ ok: true }`. `403` if not the asker; `400` if already solved.

---

## Achievements

Daily/growth tasks, badges, and reward claims. Tasks and badges are computed live from existing data.

### `GET /api/achievements`
Combined achievements for the logged-in user (also persists newly-unlocked badges). **Auth:** Auth.
- Response: `{ tasks: [...], badges: [...], stats, claimablePoints, unlockedCount }`. Each task: `{ key, title, desc, icon, points, target, daily, progress, done, claimed, claimable }`. Each badge: `{ key, name, desc, icon, tier, unlocked, unlockedAt }`.

### `GET /api/achievements/user/:id/badges`
Public badge wall for a profile (no persistence). **Auth:** Public.
- Response: `{ badges: [...], user }`. Unknown user → `404`.

### `POST /api/achievements/claim/:key`
Claim a completed task's point reward. **Auth:** Auth.
- Response: `{ ok: true, points, user }`. `400` if already claimed or task not yet complete; `404` for unknown task key.

---

## Nav

Curated link directory / 导航 (categories and links).

### `GET /api/nav`
Full directory: categories (ordered) each with their links (ordered). **Auth:** Public.
- Response: `{ categories: [{ id, name, icon, links: [{ id, title, url, description, color, clicks }] }] }`.

### `GET /api/nav/popular`
Most-clicked links (sidebar 热门导航, up to 8). **Auth:** Public.
- Response: `{ links: [...] }`.

### `POST /api/nav/:id/click`
Track a click on a link (fire-and-forget). **Auth:** Public.
- Response: `{ ok: true }`.

### `POST /api/nav/categories`
Create a navigation category. **Auth:** Admin (gated inline).
- Body: `name` (required), `icon` (default `compass`), `position`.
- Response: `{ ok: true, id }`.

### `POST /api/nav/links`
Create a navigation link. **Auth:** Admin (gated inline).
- Body: `categoryId`, `title`, `url` (all required), `description`, `color`, `position`.
- Response: `{ ok: true, id }`.
