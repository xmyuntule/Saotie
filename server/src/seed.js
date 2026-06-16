import bcrypt from 'bcryptjs';
import db from './db.js';

// ---- reset ----
const tables = ['orders','products','reports','blocks','bookmarks','rewards','notifications',
  'messages','threads','board_follows','moderators','boards','topics','purchases','likes','comments','posts','follows','users'];
db.pragma('foreign_keys = OFF');
for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
for (const t of tables) db.prepare(`DELETE FROM sqlite_sequence WHERE name=?`).run(t);
db.pragma('foreign_keys = ON');

// Demo accounts share one password. Override it per-environment via SEED_PASSWORD;
// the open-source default below is only a local convenience — CHANGE IT (or set
// SEED_PASSWORD) before any public deployment, and have real users register.
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'hahasns123';
const pw = bcrypt.hashSync(SEED_PASSWORD, 10);
const daysAgo = (d, h = 0) => {
  const date = new Date(Date.now() - d * 86400000 - h * 3600000);
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

// ---- users ----
const users = [
  ['admin','站长',   '🦊','#7c5cff', '这是 HahaSNS 站长，有问题随时私信我～', '杭州', 1, '官方认证', 1, 'admin', 9800, 1, 96],
  ['linmu','林木设计','🐼','#22b8cf', '独立设计师 / 偶尔写写字，记录生活里的光', '上海', 1, '知名设计师', 1, 'user', 6200, 1, 41],
  ['zhaoyun','赵云的小号','🐯','#ff922b','摄影爱好者，扫街 & 胶片，约拍私信', '成都', 1, '人像摄影师', 0, 'user', 4100, 0, 28],
  ['amy','Amy酱',  '🦄','#f06595', '美食探店 | 咖啡续命 | 今天也要开心呀', '广州', 0, '', 1, 'user', 3300, 0, 35],
  ['coder_k','键盘侠老K','🐙','#4c6ef5','前端切图仔，开源爱好者，bug 制造机', '北京', 0, '', 0, 'user', 5200, 1, 17],
  ['yanyu','烟雨','🐳','#15aabf', '喜欢安静地看海，喜欢一切慢下来的事物', '厦门', 0, '', 0, 'user', 2200, 0, 12],
  ['gugu','咕咕鸟','🐧','#20c997', '电竞 & 二次元，峡谷见，ID 同名', '武汉', 0, '', 0, 'user', 1800, 0, 9],
  ['tangtang','糖糖','🐝','#fab005','健身打卡第 200 天，自律给我自由 💪', '深圳', 0, '', 1, 'user', 2900, 1, 6],
  ['laozhang','老张头','🦉','#a98467','退休教师，喜欢钓鱼养花，记录平凡日子', '南京', 0, '', 0, 'user', 1500, 0, 21],
  ['miyu','小鱼干','🐸','#37b24d', '插画师，接稿中，喜欢画一切毛茸茸的东西', '重庆', 1, '插画师', 0, 'user', 3600, 0, 14],
  ['boss','创业老王','🦁','#e8590c','连续创业者，分享一点踩坑经验，互关', '杭州', 1, '创业者', 1, 'user', 4800, 1, 3],
  ['nuannuan','暖暖','🦋','#cc5de8','心理咨询师 | 愿你被世界温柔以待', '苏州', 1, '心理咨询师', 1, 'user', 4200, 0, 30],
];
const insUser = db.prepare(`INSERT INTO users
  (username,nickname,password_hash,bio,location,verified,verified_note,vip,role,experience,points,balance,checkin_streak,last_checkin,avatar,cover,created_at)
  VALUES (@username,@nickname,@pw,@bio,@location,@verified,@vnote,@vip,@role,@exp,@points,@balance,@streak,@last,@avatar,@cover,@created)`);
// Real portrait avatars (deterministic). pravatar.cc serves real face photos;
// the Avatar component falls back to an initial-on-gradient if the network is unavailable.
const PORTRAIT = [12, 5, 31, 47, 16, 24, 8, 33, 52, 9, 60, 45];
const avatarFor = (i) => `https://i.pravatar.cc/240?img=${PORTRAIT[i % PORTRAIT.length]}`;
const coverFor = (username) => `https://picsum.photos/seed/cover-${username}/900/260`;
const today = new Date().toISOString().slice(0, 10);
const ids = {};
users.forEach((u, i) => {
  const [username,nickname,emoji,color,bio,location,verified,vnote,vip,role,exp,points,streak] = u;
  const info = insUser.run({
    username, nickname, pw, bio, location, verified, vnote, vip, role,
    exp, points: points * 30 + 200, balance: vip ? 5000 : 0, streak,
    last: streak ? today : null,
    avatar: avatarFor(i), cover: coverFor(username), created: daysAgo(120 - i * 5),
  });
  ids[username] = info.lastInsertRowid;
});

// ---- follows (everyone follows admin + a web of relations) ----
const follow = db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?,?,?)');
const names = Object.keys(ids);
names.forEach((a, i) => {
  names.forEach((b, j) => {
    if (a !== b && (j === 0 || (i * 7 + j * 3) % 4 === 0)) follow.run(ids[a], ids[b], daysAgo(60 - i));
  });
});

// ---- topics ----
const topics = [
  ['今日穿搭', '分享你的每日 OOTD', 1240], ['治愈系风景', '记录让你心动的瞬间', 980],
  ['宅家美食', '在家也能做大餐', 870], ['程序员日常', '代码与咖啡的故事', 760],
  ['健身打卡', '今天你练了吗', 690], ['胶片摄影', '光影与颗粒感', 540],
  ['养猫日记', '吸猫使我快乐', 1100], ['周末去哪儿', '城市漫游指南', 430],
  ['读书笔记', '一起共读一本书', 380], ['副业搞钱', '搞钱使我快乐', 920],
];
const insTopic = db.prepare('INSERT INTO topics (name, description, post_count, hot) VALUES (?,?,?,?)');
const topicIds = {};
topics.forEach(([name, desc, hot], i) => {
  const info = insTopic.run(name, desc, 0, hot);
  topicIds[name] = info.lastInsertRowid;
});

// ---- boards (with sub-boards + moderators) ----
const insBoard = db.prepare('INSERT INTO boards (parent_id,name,slug,description,icon,announcement,sort) VALUES (?,?,?,?,?,?,?)');
const boardIds = {};
const board = (parent, name, slug, desc, icon, ann, sort) => {
  const info = insBoard.run(parent, name, slug, desc, icon, ann || '', sort);
  boardIds[slug] = info.lastInsertRowid;
  return info.lastInsertRowid;
};
const cTalk = board(null, '综合讨论', 'talk', '什么都能聊，灌水专用', '💬', '文明发言，友善交流，欢迎新朋友！', 0);
board(cTalk, '新人报到', 'newbie', '第一次发帖就来这里吧', '👋', '', 0);
board(cTalk, '吐槽大会', 'complain', '生活不易，吐槽一下', '😤', '', 1);
const cTech = board(null, '技术极客', 'tech', '前端后端、AI、硬核技术交流', '💻', '提问前请先搜索，附上代码和报错', 1);
board(cTech, '前端', 'frontend', 'React / Vue / 样式那些事', '🎨', '', 0);
board(cTech, '后端', 'backend', 'Node / 数据库 / 架构', '⚙️', '', 1);
board(null, '兴趣同好', 'hobby', '摄影、游戏、二次元、手作', '🎮', '找到你的同好小圈子', 2);
board(null, '二手闲置', 'market', '闲置交易，请注意交易安全', '🛍️', '禁止虚假交易，谨防诈骗', 3);

const insMod = db.prepare('INSERT OR IGNORE INTO moderators (board_id, user_id) VALUES (?,?)');
insMod.run(boardIds.tech, ids.coder_k);
insMod.run(boardIds.frontend, ids.coder_k);
insMod.run(boardIds.talk, ids.laozhang);
insMod.run(boardIds.hobby, ids.zhaoyun);

// ---- board subscriptions / 关注板块 ----
const insBFollow = db.prepare('INSERT OR IGNORE INTO board_follows (user_id, board_id, created_at) VALUES (?,?,?)');
[['admin','tech'],['admin','hobby'],['linmu','frontend'],['linmu','tech'],['coder_k','frontend'],['coder_k','backend'],
 ['amy','hobby'],['gugu','hobby'],['tangtang','talk'],['zhaoyun','hobby'],['boss','tech']].forEach(([u, s], i) => {
  if (boardIds[s]) insBFollow.run(ids[u], boardIds[s], daysAgo(30 - i));
});

// ---- posts ----
const img = (seed, w = 800, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const insPost = db.prepare(`INSERT INTO posts
  (user_id,content,media,media_type,visibility,price,location,device,topic_id,views,like_count,comment_count,share_count,created_at)
  VALUES (@user,@content,@media,@mtype,@vis,@price,@loc,@device,@topic,@views,@likes,@comments,@shares,@created)`);
const P = [];
const post = (user, content, opts = {}) => {
  const info = insPost.run({
    user: ids[user], content,
    media: JSON.stringify(opts.media || []),
    mtype: opts.mtype || 'text', vis: opts.vis || 'public', price: opts.price || 0,
    loc: opts.loc || '', device: opts.device || (Math.random() > 0.5 ? '手机端' : '电脑端'),
    topic: opts.topic ? topicIds[opts.topic] : null,
    views: opts.views ?? Math.floor(Math.random() * 800 + 20),
    likes: opts.likes ?? Math.floor(Math.random() * 60),
    comments: 0, shares: opts.shares ?? Math.floor(Math.random() * 8),
    created: daysAgo(opts.d ?? 0, opts.h ?? 0),
  });
  if (opts.topic) db.prepare('UPDATE topics SET post_count = post_count + 1 WHERE id=?').run(topicIds[opts.topic]);
  P.push(info.lastInsertRowid);
  return info.lastInsertRowid;
};

post('linmu', '新做的一组品牌视觉，灰调里加了一点克莱因蓝，分寸感很重要。#今日穿搭#（其实是配色灵感啦）',
  { media: [{type:'image',url:img('design1')},{type:'image',url:img('design2')},{type:'image',url:img('design3')}], mtype:'image', loc:'上海', topic:'今日穿搭', d:0, h:2, likes:128, views:2300, shares:12 });
post('zhaoyun', '清晨五点的菜市场，热气和吆喝声里全是生活。胶片就是有种数码给不了的温度。',
  { media: [{type:'image',url:img('film1')},{type:'image',url:img('film2')}], mtype:'image', loc:'成都', topic:'胶片摄影', d:0, h:5, likes:89, views:1500 });
post('amy', '挖到一家藏在巷子里的咖啡馆，手冲耶加雪菲，柠檬和花香一下子就上来了，氛围感拉满☕️',
  { media: [{type:'image',url:img('coffee1')}], mtype:'image', loc:'广州', topic:'宅家美食', d:0, h:8, likes:64, views:980 });
post('coder_k', '调了一下午的 flex 布局，最后发现是少写了 min-width:0。前端的尽头是 CSS，CSS 的尽头是玄学。#程序员日常#',
  { loc:'北京', topic:'程序员日常', d:1, likes:203, views:3400, shares:24, device:'电脑端' });
post('tangtang', '健身第 200 天打卡！从 120 斤到 102 斤，自律真的会上瘾。附上今天的训练计划，需要的扣 1。',
  { media:[{type:'image',url:img('gym1')}], mtype:'image', loc:'深圳', topic:'健身打卡', d:1, h:3, likes:312, views:5200 });
post('miyu', '摸鱼画了只小狐狸，毛茸茸的手感太治愈了。完整过程图付费可见，支持一下吃饭画手🦊',
  { media:[{type:'image',url:img('fox1')}], mtype:'image', vis:'paid', price:50, loc:'重庆', d:1, h:6, likes:156, views:2100 });
post('yanyu', '海边的风把所有烦恼都吹散了。有时候什么都不做，只是发呆，也很好。',
  { media:[{type:'image',url:img('sea1')},{type:'image',url:img('sea2')}], mtype:'image', loc:'厦门', topic:'治愈系风景', d:2, likes:78, views:1200 });
post('boss', '创业三年，最大的体会：别和趋势作对，但也别盲目追风口。分享我踩过的 5 个坑，认真写了很长一段——',
  { loc:'杭州', topic:'副业搞钱', d:2, h:4, likes:241, views:6800, shares:56 });
post('gugu', '昨晚排位连跪五把，今天满血复活，直接一波七连胜上大师！峡谷里没有奇迹，只有努力（和队友）。',
  { mtype:'text', loc:'武汉', d:2, h:8, likes:45, views:670 });
post('nuannuan', '"你不需要时刻坚强。" —— 今天想把这句话送给每一个还在硬撑的你。允许自己脆弱，也是一种力量。',
  { topic:'读书笔记', loc:'苏州', d:3, likes:189, views:2900, shares:34 });
post('laozhang', '院子里的月季开了第一茬，养花和养人一样，急不得。慢慢来，比较快。',
  { media:[{type:'image',url:img('rose1')}], mtype:'image', loc:'南京', d:3, h:5, likes:92, views:880 });
post('admin', '🎉 HahaSNS 全新上线！这里有动态、话题、论坛、私信、签到、积分等你来玩。遇到问题随时反馈，祝大家玩得开心～',
  { loc:'杭州', d:4, likes:520, views:12000, shares:88, device:'电脑端' });
post('amy', '匿名说点心里话：其实今天工作搞砸了，有点难过，但还是想给自己打打气。明天会更好的吧。',
  { vis:'anonymous', d:0, h:1, likes:67, views:430 });
post('coder_k', '开源了我的周末小项目：一个极简的 Markdown 笔记应用，纯前端，欢迎 star 和提 issue～',
  { mtype:'text', loc:'北京', topic:'程序员日常', d:4, h:2, likes:134, views:2400, shares:41 });
// ---- real, playable sample media ----
const VID = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://www.w3schools.com/html/mov_bbb.mp4',
];
const AUD = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
];

post('zhaoyun', '一段海边延时，献给所有热爱生活的人。视频是用手机拍的，后期调了一下色。',
  { media:[{type:'video',url:VID[0],poster:img('video-cover1',800,450)}], mtype:'video', loc:'成都', topic:'治愈系风景', d:5, likes:98, views:3100 });

// ---- more demo posts: deeper feed, varied media ----
post('amy', '今天的 vlog 剪好啦！记录了一整天的探店，配上喜欢的 BGM，看完记得三连～',
  { media:[{type:'video',url:VID[1],poster:img('vlog1',800,450)}], mtype:'video', loc:'广州', topic:'宅家美食', d:0, h:3, likes:176, views:4200, shares:18 });
post('yanyu', '深夜放首歌给你听。最近单曲循环，前奏一响整个人就软下来了。🎧',
  { media:[{type:'audio',url:AUD[0],title:'夜色温柔',artist:'烟雨 · 翻唱',cover:img('music1',300,300)}], mtype:'music', loc:'厦门', d:0, h:6, likes:142, views:2600 });
post('miyu', '自己写的一段钢琴小品，第一次发，轻喷～想给我的插画当背景音乐。',
  { media:[{type:'audio',url:AUD[1],title:'小狐狸的下午',artist:'小鱼干',cover:img('music2',300,300)}], mtype:'music', loc:'重庆', topic:'读书笔记', d:1, h:1, likes:98, views:1500 });
post('gugu', '新番第一集就封神了！画面、配乐、节奏全在线，二次元狂喜，蹲一个第二集🔥',
  { media:[{type:'image',url:img('anime1')},{type:'image',url:img('anime2')}], mtype:'image', loc:'武汉', d:0, h:4, likes:67, views:1120 });
post('tangtang', '早餐分享 🥗 减脂期也能吃得很满足：全麦吐司+牛油果+水波蛋，热量友好又顶饱。',
  { media:[{type:'image',url:img('breakfast1')}], mtype:'image', loc:'深圳', topic:'宅家美食', d:0, h:7, likes:203, views:3100 });
post('laozhang', '清晨去江边钓鱼，雾还没散，水面安静得像镜子。钓不钓得到都不重要了。',
  { media:[{type:'image',url:img('fishing1')},{type:'image',url:img('fishing2')},{type:'image',url:img('fishing3')}], mtype:'image', loc:'南京', topic:'治愈系风景', d:1, h:2, likes:88, views:760 });
post('boss', '聊点干货：早期团队怎么招到第一批靠谱的人？我的三条标准——①认同方向 ②能扛事 ③愿意成长。展开说说。',
  { loc:'杭州', topic:'副业搞钱', d:1, h:5, likes:198, views:5400, shares:47 });
post('coder_k', '把博客迁到了自建服务器，顺手写了套 CI 自动部署。折腾的快乐，只有程序员懂。#程序员日常#',
  { media:[{type:'image',url:img('code1')}], mtype:'image', loc:'北京', topic:'程序员日常', d:2, h:2, likes:121, views:1980, shares:9 });
post('linmu', '周末逛了场美术馆，光影和留白用得太克制了，受益匪浅。设计的尽头是审美。',
  { media:[{type:'image',url:img('gallery1')},{type:'image',url:img('gallery2')},{type:'image',url:img('gallery3')},{type:'image',url:img('gallery4')}], mtype:'image', loc:'上海', d:2, h:6, likes:154, views:2400 });
post('nuannuan', '#读书笔记# 在读《被讨厌的勇气》，"自由就是被别人讨厌"。共勉。',
  { topic:'读书笔记', loc:'苏州', d:2, h:9, likes:167, views:2100, shares:22 });
post('amy', '同城有没有一起拼饭的呀？发现一家新开的云南菜，人均不贵想约个饭搭子～',
  { loc:'广州', d:0, h:2, likes:34, views:560 });
post('zhaoyun', '街头扫到的瞬间，光打在他脸上的那一刻刚好。摄影就是和时间赛跑。',
  { media:[{type:'image',url:img('street1')}], mtype:'image', loc:'成都', topic:'胶片摄影', d:3, h:1, likes:112, views:1670 });
post('gugu', '整理了一份新手向的机械键盘选购清单，从轴体到配列都讲了，需要的自取。',
  { loc:'武汉', d:3, h:4, likes:78, views:1340, shares:15 });
post('tangtang', '这条是付费内容：我的 12 周增肌训练全计划 + 饮食表，亲测有效，解锁查看💪',
  { vis:'paid', price:80, loc:'深圳', topic:'健身打卡', d:3, h:8, likes:64, views:1900 });
post('miyu', '加密动态：给老朋友的悄悄话，知道暗号的进来～',
  { vis:'password', password:'2024', loc:'重庆', d:4, h:1, likes:23, views:340 });
post('yanyu', '匿名：有点羡慕那些很快就能放下的人，我总是想太多。',
  { vis:'anonymous', d:1, h:3, likes:89, views:680 });
post('laozhang', '今日份的夕阳，老伴说像咸蛋黄，我说像我们年轻时候。',
  { media:[{type:'image',url:img('sunset1')}], mtype:'image', loc:'南京', topic:'治愈系风景', d:4, h:7, likes:201, views:2300, shares:31 });
post('boss', '复盘一次失败的产品：我们做对了体验，却忽略了渠道。教训：好产品 ≠ 好生意。',
  { loc:'杭州', topic:'副业搞钱', d:5, h:2, likes:176, views:4100, shares:38 });
post('coder_k', 'AI 辅助编程这一年，我的真实体感：它让我快了 30%，但也让 review 更重要了。',
  { loc:'北京', topic:'程序员日常', d:5, h:5, likes:233, views:5600, shares:52 });

// ---- reposts / 转发(share_of) ----
const repost = (user, srcIdx, content, opts = {}) => {
  const info = insPost.run({
    user: ids[user], content, media: '[]', mtype: 'text', vis: 'public', price: 0,
    loc: opts.loc || '', device: opts.device || '手机端', topic: null,
    views: opts.views ?? Math.floor(Math.random() * 400 + 20),
    likes: opts.likes ?? Math.floor(Math.random() * 40), comments: 0,
    shares: 0, created: daysAgo(opts.d ?? 0, opts.h ?? 0),
  });
  db.prepare('UPDATE posts SET share_of=? WHERE id=?').run(P[srcIdx], info.lastInsertRowid);
  db.prepare('UPDATE posts SET share_count = share_count + 1 WHERE id=?').run(P[srcIdx]);
  P.push(info.lastInsertRowid);
};
repost('amy', 0, '设计师的配色真的绝，学到了！转发收藏~', { loc:'广州', d:0, h:1, likes:32 });   // 转 林木设计 品牌视觉(多图)
repost('gugu', 4, '健身大佬带带我！立个 flag 也开始打卡', { loc:'武汉', d:0, h:3, likes:18 });    // 转 tangtang 健身打卡(图)
repost('coder_k', 14, '海边延时太治愈了，周末也想去拍', { loc:'北京', d:1, h:2, likes:27 });      // 转 zhaoyun 视频

// ---- comments ----
const insComment = db.prepare(`INSERT INTO comments (post_id,user_id,parent_id,reply_to,content,like_count,created_at)
  VALUES (?,?,?,?,?,?,?)`);
const comment = (postIdx, user, content, opts = {}) => {
  const pid = P[postIdx];
  const info = insComment.run(pid, ids[user], opts.parent || null, opts.replyTo ? ids[opts.replyTo] : null, content, opts.likes || Math.floor(Math.random()*10), daysAgo(opts.d ?? 0, opts.h ?? 0));
  db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id=?').run(pid);
  return info.lastInsertRowid;
};
const c1 = comment(0, 'amy', '这个配色太高级了，求问克莱因蓝的色值🥺', { likes: 12 });
comment(0, 'linmu', '#2647 给你～可以根据场景微调饱和度', { replyTo: 'amy', parent: c1, likes: 8 });
comment(0, 'coder_k', '设计师的审美就是不一样', {});
comment(3, 'linmu', '哈哈哈 min-width:0 害人不浅，flex 子项溢出经典坑', { likes: 15 });
comment(3, 'boss', '前端不易，敬你一杯咖啡☕️', {});
comment(4, 'nuannuan', '太自律了，被你激励到，明天也去运动！', { likes: 6 });
comment(4, 'gugu', '求训练计划！扣 1', {});
comment(7, 'coder_k', '说得太对了，趋势和风口是两码事', { likes: 9 });
comment(11, 'linmu', '支持站长！界面做得很舒服👍', { likes: 20 });
comment(11, 'tangtang', '终于有个清爽的社区了，撒花🎉', {});
// engagement on the newer posts
comment(15, 'tangtang', 'vlog 的转场好丝滑，用什么剪的呀？', { likes: 7 });
const c2 = comment(15, 'gugu', 'BGM 是什么？太好听了', {});
comment(15, 'amy', '歌名放评论区置顶啦～', { replyTo: 'gugu', parent: c2, likes: 5 });
comment(16, 'nuannuan', '深夜听到这首，眼眶突然就热了', { likes: 11 });
comment(17, 'linmu', '居然还会作曲，太全能了吧', { likes: 8 });
comment(18, 'coder_k', '同蹲第二集，已经加进追番列表', {});
comment(19, 'amy', '这个搭配我也常吃，水波蛋是灵魂', { likes: 6 });
comment(21, 'coder_k', '第二条太真实了，招到能扛事的太难', { likes: 13 });
comment(21, 'linmu', '受教了，正在组团队的路上', {});
comment(23, 'zhaoyun', '留白是高级感的来源，认同', { likes: 9 });
comment(24, 'yanyu', '这本我也在读，金句太多了', { likes: 5 });
comment(31, 'nuannuan', '"像我们年轻时候" 这句破防了', { likes: 18 });
comment(33, 'boss', 'review 更重要 +1，AI 写的代码更要盯紧', { likes: 14 });

// ---- likes (varied per user so every profile's 赞过 tab has content) ----
const insLike = db.prepare('INSERT OR IGNORE INTO likes (user_id,target_type,target_id,created_at) VALUES (?,?,?,?)');
P.forEach((pid, i) => {
  names.forEach((n, j) => { if (((i + 1) * 3 + (j + 1) * 7) % 5 < 2) insLike.run(ids[n], 'post', pid, daysAgo((i + j) % 6, j)); });
});

// ---- threads ----
const insThread = db.prepare(`INSERT INTO threads (board_id,user_id,title,content,media,pinned,elite,views,like_count,reply_count,last_reply_at,created_at)
  VALUES (@board,@user,@title,@content,@media,@pin,@elite,@views,@likes,@replies,@last,@created)`);
const thread = (slug, user, title, content, opts = {}) => {
  const info = insThread.run({
    board: boardIds[slug], user: ids[user], title, content,
    media: JSON.stringify(opts.media || []),
    pin: opts.pin ? 1 : 0, elite: opts.elite ? 1 : 0,
    views: opts.views ?? Math.floor(Math.random()*500+30),
    likes: opts.likes ?? Math.floor(Math.random()*40),
    replies: opts.replies ?? Math.floor(Math.random()*20),
    last: daysAgo(opts.ld ?? 0, opts.lh ?? 1), created: daysAgo(opts.d ?? 1),
  });
  db.prepare('UPDATE boards SET thread_count = thread_count + 1 WHERE id=?').run(boardIds[slug]);
  return info.lastInsertRowid;
};
thread('talk', 'admin', '【必读】HahaSNS 社区公约 & 新手指南', '欢迎来到 HahaSNS！为了营造良好的社区氛围，请大家遵守以下公约：1. 友善交流；2. 禁止广告；3. 原创优先……', { pin: 1, elite: 1, views: 8800, likes: 230, replies: 56 });
thread('newbie', 'tangtang', '新人报到～我是来自深圳的健身爱好者', '大家好呀！刚加入这个社区，看起来氛围超好，希望能在这里认识更多朋友，一起进步！', { replies: 18, likes: 42, ld: 0 });
thread('frontend', 'coder_k', '2026 年了，你还在用什么前端框架？聊聊技术选型', '最近在做技术选型，React 19、Vue 3.5、Svelte 5、Solid，大家现在生产环境都用啥？说说优缺点呗。', { elite: 1, views: 3400, likes: 156, replies: 89, ld: 0 });
thread('frontend', 'linmu', '分享一套我常用的设计稿还原工作流', '从 Figma 到代码，我总结了一套提升还原度的流程，附带几个好用的插件推荐……', { elite: 1, likes: 78, replies: 34, ld: 1 });
thread('backend', 'boss', 'SQLite 到底能不能扛生产？说说我的真实经验', '很多人觉得 SQLite 是玩具，其实在读多写少的场景下它非常能打。分享一下我们的实测数据……', { views: 2100, likes: 98, replies: 45, ld: 0 });
thread('hobby', 'zhaoyun', '【约拍】成都人像摄影，免费约几位出镜', '最近在练习自然光人像，想找几位小伙伴互免，地点市区，有意私信我看作品～。附几张近期作品：', { likes: 56, replies: 23, ld: 0, media: [{type:'image',url:img('portfolio1')},{type:'image',url:img('portfolio2')},{type:'image',url:img('portfolio3')}] });
thread('hobby', 'gugu', '晒晒我的桌搭，肝了一周终于成型了', '主机+双屏+客制化键盘，灯光氛围拉满，求评分！有问题欢迎交流配置。', { likes: 88, replies: 31, ld: 0, media: [{type:'image',url:img('desk1')},{type:'image',url:img('desk2')}] });
thread('complain', 'gugu', '吐槽一下今天的排位队友……', '已经连跪五把了，到底是我太菜还是队友太坑？在线等，挺急的（不是）', { likes: 34, replies: 67, ld: 0 });
thread('market', 'amy', '出一台 95 新的咖啡手冲套装', '搬家闲置，整套手冲器具，含手摇磨豆机、滤杯、分享壶，原价 600，现 280 出，同城自取优先。', { likes: 12, replies: 8, ld: 1 });

// ---- thread replies (comments on threads) ----
const insTReply = db.prepare(`INSERT INTO comments (thread_id,user_id,content,like_count,created_at) VALUES (?,?,?,?,?)`);
insTReply.run(3, ids.linmu, 'React 生态最成熟，但 Svelte 写起来是真的爽', 12, daysAgo(0,2));
insTReply.run(3, ids.boss, '生产环境还是看团队熟悉度，别盲目追新', 8, daysAgo(0,1));
insTReply.run(1, ids.admin, '欢迎欢迎！有问题随时问～', 5, daysAgo(0,1));

// ---- messages ----
const insMsg = db.prepare('INSERT INTO messages (sender_id,receiver_id,content,type,read,created_at) VALUES (?,?,?,?,?,?)');
insMsg.run(ids.linmu, ids.admin, '站长你好，想问下话题怎么申请加精呀？', 'text', 1, daysAgo(0,5));
insMsg.run(ids.admin, ids.linmu, '你好～内容优质的话发我链接，我帮你看看👌', 'text', 1, daysAgo(0,4));
insMsg.run(ids.linmu, ids.admin, '这是我最近的一组作品，您看看～', 'text', 1, daysAgo(0,4));
insMsg.run(ids.linmu, ids.admin, img('dmwork1', 600, 800), 'image', 1, daysAgo(0,3));
insMsg.run(ids.admin, ids.linmu, '质感很棒！我帮你标了加精 ✅', 'text', 1, daysAgo(0,3));
insMsg.run(ids.amy, ids.admin, '界面真好看，请问能换主题色吗？', 'text', 0, daysAgo(0,2));
insMsg.run(ids.zhaoyun, ids.admin, '约拍的帖子审核通过啦，谢谢站长！', 'text', 0, daysAgo(0,1));

// ---- notifications for admin (so the bell has content) ----
const insNotif = db.prepare('INSERT INTO notifications (user_id,actor_id,type,target_type,target_id,preview,read,created_at) VALUES (?,?,?,?,?,?,?,?)');
insNotif.run(ids.admin, ids.linmu, 'like', 'post', P[11], '界面做得很舒服', 0, daysAgo(0,1));
insNotif.run(ids.admin, ids.tangtang, 'follow', 'user', ids.tangtang, '', 0, daysAgo(0,2));
insNotif.run(ids.admin, ids.amy, 'comment', 'post', P[11], '终于有个清爽的社区了', 1, daysAgo(0,3));

// ---- mall products / 积分商城 ----
const insProduct = db.prepare('INSERT INTO products (name,description,icon,category,payload,price,stock,sold) VALUES (?,?,?,?,?,?,?,?)');
const products = [
  ['「社区元老」头衔', '彰显你的资历，主页与动态展示专属头衔', '🏅', 'title', '社区元老', 800, -1, 23],
  ['「夜猫子」头衔', '凌晨还在冲浪的你值得拥有', '🌙', 'title', '夜猫子', 300, -1, 67],
  ['「锦鲤」头衔', '好运连连，欧气满满', '🎏', 'title', '锦鲤', 1200, 100, 41],
  ['彩虹头像框', '限定头像装扮，让你的头像更出众', '🌈', 'frame', 'rainbow', 600, -1, 88],
  ['鎏金头像框', '尊贵鎏金边框,身份的象征', '✨', 'frame', 'gold', 1500, 50, 12],
  ['全站置顶卡 ×1', '让你的一条动态全站置顶 24 小时', '📌', 'item', 'pin', 500, -1, 156],
  ['改名卡 ×1', '修改一次用户名的机会', '✏️', 'item', 'rename', 200, -1, 203],
  ['HahaSNS 定制马克杯', '实物周边,陶瓷马克杯一只(演示)', '☕', 'physical', 'mug', 5000, 30, 8],
  ['限定贴纸包', '可爱贴纸一套(演示实物)', '🧧', 'physical', 'sticker', 2000, 80, 35],
];
products.forEach(p => insProduct.run(...p));

console.log('✅ Seed complete:', {
  users: names.length, posts: P.length, topics: topics.length,
  boards: Object.keys(boardIds).length, products: products.length,
});
db.close();
