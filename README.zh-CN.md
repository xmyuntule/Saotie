**[English](README.md) · 简体中文**

# HahaSNS · 轻社交 · 轻论坛 · 轻社区

> **HahaSNS**（中文主题名「哈哈」）是一款轻量级的一体化社交社区平台 —— 集信息流式 SNS、BBS 论坛与积分驱动的社区中心于一身，全部融合在一个精致的 Web 应用中。中文界面以真实产品的标准打磨，桌面端采用三栏布局，移动端采用底部标签栏布局。

**HahaSNS = 轻社交 · 轻论坛 · 轻社区** —— 一款基于现代 React + Express + SQLite 技术栈、从零原创打造的轻量社交社区平台。

🔗 **在线演示：** http://43.226.60.75:5388

### 💬 加入社区

种子用户们，欢迎加入 **HahaSNS 微信群**，一起反馈体验、抢先尝鲜、共建路线图：

<img src="docs/wechat-group.png" alt="HahaSNS 微信种子用户群二维码" width="220" />

用微信扫码加群；或添加微信号 **`xiaolizi1579687`**（凤梨酥）为好友，邀你进群。
_（群二维码会定期更新，若已失效，直接加上面的微信号即可。）_

![home](docs/home.png)

---

## ✨ 功能特性

### 会员中心 / Member Center
- 基于 JWT 的注册 / 登录（密码使用 `bcryptjs` 哈希）
- 头像 + 封面图、个性签名（简介）、性别、城市/所在地
- **V 认证**（认证徽章）、**VIP** 会员、**等级系统**（经验值驱动的 `Lv.X`）、**积分** 与 **余额**（钱包）
- **每日签到**（连续签到天数 + 积分/经验奖励）
- 关注 / 粉丝、私信、消息通知（关注 / 点赞 / 评论 / 回复 / @提及 / 打赏 / 系统）
- 充值中心（模拟）+ VIP 开通
- 修改用户名（消耗一张商城道具「改名卡」）、修改密码

### SNS 动态 / Feed
- 发布文字 / 图片 / 视频 / 音乐（音频）动态
- **5 种可见范围**：公开 public · 私密 private · 密码 password · 付费 paid · 匿名 anonymous
- 点赞 · 嵌套评论 · 转发 · @提及 · `#话题#` 话题 · 打赏
- 定位 · 设备标识（手机端 / 电脑端）· 浏览量
- 动态筛选：推荐 recommend · 最新 latest · 关注 following · 视频 video · 同城 same-city
- 收藏、置顶自己的动态、全站置顶（全站置顶卡）、付费内容解锁

### BBS 论坛 / Forum
- 板块 + 子板块、版主
- 发帖、嵌套回复、点赞
- 帖子管理：置顶 · 精华 · 锁定 · 删除
- 板块封面 / 图标 / 公告 / 排序；帖子按 最新回复 / 热门 / 精华 排序
- 关注板块

### 话题 · 商城 · 后台 / Topics, Mall & Admin
- 话题广场、热门话题、关注话题
- **积分商城 / Points mall**：兑换头衔、头像框、消耗类道具，以及实物商品 —— 含库存 / 售罄 / 已拥有 状态
- **后台管理 / Admin**（仅管理员）：站点统计 + 7 天活跃度、用户管理（设置 V / VIP / 管理员 / 封禁 / 积分）、板块增删改查 + 分配版主、话题管理、举报处理、商品管理、内容下架

### 圈子 / Circles — 兴趣社区
- 创建并加入兴趣 **圈子**，可设置名称、描述、图标与颜色
- 分类：兴趣 · 科技 · 生活 · 创作 · 同城；可按 热门 hot / 最新 new 浏览，或查看「我加入的」
- 每个圈子的成员动态 **信息流**、成员列表、实时成员 / 动态数；侧边栏推荐你尚未加入的圈子
- 圈主自动加入且无法退出自己的圈子

### 投票 / Polls
- 为任意动态附加 **单选或多选投票**（2–6 个选项）
- 可选 **截止时间**（最长 30 天）并带实时倒计时；支持长期投票
- 每位用户仅可投一票；**实时结果**（各选项百分比 + 总参与人数）在你投票后或投票结束后揭晓

### 问答 · 悬赏 / Q&A with Bounties
- 提问可附带可选的 **积分悬赏** —— 提交时从提问者处 **托管** 相应积分
- 分类（综合 · 技术 · 生活 · 情感 · 职场 · 校园 · 数码）及排序：最新 / 热门 / 悬赏
- 发布 **回答**、为最佳回答 **点赞**（可取消）；提问者可 **采纳** 最佳回答 —— 此举将问题标记为 已解决 并把 **悬赏积分转给** 回答者
- 新回答 / 被采纳时发送通知；高悬赏未解决问题会在侧边栏重点推荐

### 资讯快报 / Flash News
- 分类的 **资讯与公告门户**（公告 · 功能 · 活动 · 精选 · 教程）
- 置顶优先、最新优先的信息流；条目可外链到完整 URL
- 由管理员发布（仅管理员可发布）

### 网址导航 / Link Directory
- 精选的 **网址导航**，按有序分类组织，每个分类下有序排列链接
- **点击排行** —— 每次访问都会被记录，驱动「热门导航」（点击最多）侧边栏小组件
- 由管理员管理分类与链接

### 任务 · 勋章 / Tasks & Achievements
- **任务中心 / Task center**：每日任务（签到 / 发布动态 / 评论 / 点赞 / 参与投票）+ 成长任务（完善资料），完成后可 **领取** 积分奖励；进度根据你的真实活动实时计算
- **成就勋章 / Achievement badges**：分级（青铜 / 白银 / 黄金）徽章，依据累计数据解锁 —— 首次发帖、发帖 20 篇、投票 10 次、连续签到 7 天、50 名粉丝、200 个赞、被采纳回答、圈子创始人、VIP —— 展示于个人 **勋章墙** 及公开主页

### 其它 / Extras
- 全局搜索（用户 · 动态 · 帖子 · 话题）、热搜关键词（热搜榜）
- **排行榜 / Leaderboards**：财富榜 · 等级榜 · 人气榜 · 签到榜
- 推荐关注用户、拉黑名单、举报内容、问题反馈
- 🎨 **6 套配色皮肤**（经典蓝 / 锐紫 / 翡翠 / 落日橙 / 玫瑰 / 青碧）× 🌗 浅色 / 深色，配合 framer-motion 页面转场；响应式（桌面三栏 + 移动底部标签栏）
- 内置针对用户生成内容的敏感词过滤

---

## 🖼️ 截图

| Home / 首页 | Mall / 积分商城 | Admin / 后台 |
| --- | --- | --- |
| ![home](docs/home.png) | ![mall](docs/mall.png) | ![admin](docs/admin.png) |

> _欢迎补充更多截图 —— 放入 `docs/` 目录并在此处引用即可。_

---

## 🧱 技术栈

| 层级 | 选型 |
| --- | --- |
| 前端 | **React 18** + **Vite 5**、React Router 6、Axios |
| UI | 基于 **Tailwind CSS** 的 **HeroUI v2.8**（`@heroui/react`），配合 **framer-motion** 页面转场，外加一套手写的 **自定义 CSS 设计系统**（tokens → base → layout → components → pages）。**6 套配色皮肤**（经典蓝 / 锐紫 / 翡翠 / 落日橙 / 玫瑰 / 青碧）× 浅色/深色，通过 `ThemeContext` 在运行时切换主题 |
| 后端 | **Node.js** + **Express 4** |
| 数据库 | **better-sqlite3**（嵌入式 SQLite，WAL 模式） |
| 鉴权 | JWT（`jsonwebtoken`）+ `bcryptjs` |
| 上传 | `multer`（本地磁盘，图片 / 视频 / 音频） |

无需配置任何外部数据库或服务 —— SQLite 以单文件形式存放在 `server/data/` 下，首次运行时自动创建。

---

## 🚀 快速开始

需要 **Node.js 18+**。

```bash
# 1. install deps for both server and client
npm run install:all          # or: npm --prefix server install && npm --prefix client install

# 2. seed demo data (12 showcase users, posts, topics, boards, threads, messages, mall)
npm run seed                 # runs server/src/seed.js + seed-extra.js

# 3a. dev mode — hot reload (server on :4000, client on :5173 with /api proxy)
npm install                  # installs `concurrently` at the repo root
npm run dev                  # → http://localhost:5173

# 3b. OR production mode — build the client, serve API + static SPA on one port
npm start                    # builds client/dist, then → http://localhost:4000
```

**演示账号（仅限你自己 seed 的实例）：** 执行 `npm run seed` 后，会创建一个 `admin` 账号以及所有演示用户（`linmu`、`coder_k`、`amy`、……），密码均为 `hahasns123` —— 可通过 `SEED_PASSWORD` 环境变量覆盖，并请 **在任何公开部署之前修改它**。这些凭据仅用于本地/自托管实例；在上方托管的演示站点上，请直接注册你自己的账号。

完整安装指南请参阅 **[docs/INSTALL.md](docs/INSTALL.md)**（含批量 seed 到 1,000 用户 / 10,000 动态），REST 接口参考见 **[docs/API.md](docs/API.md)**，部署说明见 **[docs/DEPLOY.md](docs/DEPLOY.md)**，系统架构见 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**。

---

## 📁 项目结构

```
hahasns/
├── server/                     # Express API + SQLite
│   ├── .env.example            # environment variable template
│   └── src/
│       ├── index.js            # app entry (registers routes, serves built client)
│       ├── db.js               # SQLite connection + schema load + migrations
│       ├── schema.sql          # full DB schema (users, posts, threads, mall, …)
│       ├── helpers.js          # levels/exp, publicUser serialization, notifications
│       ├── sensitive.js        # sensitive-word filter
│       ├── seed.js             # base demo data (12 users + content)
│       ├── seed-extra.js       # idempotent content top-up (topics/boards/notifs)
│       ├── seed-bulk.js        # scale to N users / M posts (default 1000 / 10000)
│       ├── middleware/auth.js  # JWT sign / optionalAuth / requireAuth / requireAdmin
│       └── routes/             # auth, users, posts (incl. polls), comments, forum,
│                               # messages, notifications, topics, mall, feedback,
│                               # search, upload, admin, reports, circles, qa,
│                               # flash, nav, achievements
└── client/                     # React + Vite SPA
    └── src/
        ├── api/client.js       # Axios instance (baseURL '/api', Bearer token)
        ├── pages/              # Home, Discover, Topic, Forum, Board, ThreadDetail,
        │                       # PostDetail, Profile, Messages, Notifications,
        │                       # Member, Mall, Bookmarks, Admin, Search, Settings,
        │                       # Circles, CircleDetail, QA, QADetail, Flash, Nav,
        │                       # Achievements, Leaderboard, …
        ├── components/         # Navbar, Shell, PostCard, Composer, Comments, Poll, …
        ├── context/            # AuthContext, ToastContext, ThemeContext (6 skins × light/dark)
        └── styles/             # tokens (light + dark + skins), base, layout, components, pages
```

---

## 📄 许可证

以 **MIT License** 发布（占位 —— 发布前请添加 `LICENSE` 文件）。

> 随附的演示媒体（头像、封面图、示例视频/音频）均取自第三方服务（pravatar.cc、picsum.photos 等），仅用于演示。生产使用时请替换为你自己的素材。
