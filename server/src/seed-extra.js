// Idempotent demo-data enrichment: tops up sparse topics and forum boards so
// every topic/board has content. Safe to run repeatedly — it only adds rows up
// to a per-target threshold and never deletes. Run once after deploy:
//   node src/seed-extra.js
import db from './db.js';

const daysAgo = (d, h = 0) =>
  new Date(Date.now() - d * 86400000 - h * 3600000).toISOString().slice(0, 19).replace('T', ' ');
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const img = (seed) => `https://picsum.photos/seed/${seed}/800/600`;

const ids = Object.fromEntries(db.prepare('SELECT username, id FROM users').all().map(u => [u.username, u.id]));
const topicIds = Object.fromEntries(db.prepare('SELECT name, id FROM topics').all().map(t => [t.name, t.id]));
const boardIds = Object.fromEntries(db.prepare('SELECT slug, id FROM boards').all().map(b => [b.slug, b.id]));

const insPost = db.prepare(`INSERT INTO posts
  (user_id,content,media,media_type,visibility,price,location,device,topic_id,views,like_count,comment_count,share_count,created_at)
  VALUES (@user,@content,@media,@mtype,@vis,@price,@loc,@device,@topic,@views,@likes,0,@shares,@created)`);
const addPost = (user, content, o = {}) => {
  insPost.run({
    user: ids[user], content, media: JSON.stringify(o.media || []),
    mtype: o.media?.length ? 'image' : 'text', vis: 'public', price: 0,
    loc: o.loc || '', device: Math.random() > 0.5 ? '手机端' : '电脑端',
    topic: o.topic ? topicIds[o.topic] : null,
    views: rnd(120, 2600), likes: rnd(8, 180), shares: rnd(0, 14),
    created: daysAgo(o.d ?? rnd(1, 9), o.h ?? rnd(0, 20)),
  });
  if (o.topic) db.prepare('UPDATE topics SET post_count = post_count + 1 WHERE id=?').run(topicIds[o.topic]);
};

const insThread = db.prepare(`INSERT INTO threads (board_id,user_id,title,content,media,pinned,elite,views,like_count,reply_count,last_reply_at,created_at)
  VALUES (@board,@user,@title,@content,@media,0,@elite,@views,@likes,@replies,@last,@created)`);
const addThread = (slug, user, title, content, o = {}) => {
  const d = o.d ?? rnd(1, 8);
  insThread.run({
    board: boardIds[slug], user: ids[user], title, content, media: JSON.stringify(o.media || []),
    elite: o.elite ? 1 : 0, views: rnd(60, 2200), likes: rnd(10, 120), replies: rnd(2, 40),
    last: daysAgo(Math.max(0, d - rnd(0, 1)), rnd(1, 20)), created: daysAgo(d),
  });
  db.prepare('UPDATE boards SET thread_count = thread_count + 1 WHERE id=?').run(boardIds[slug]);
};

// ---- content banks (more entries than needed; we take what's missing) ----
const TOPIC_POSTS = {
  '今日穿搭': [
    ['amy', '#今日穿搭# 今日多巴胺穿搭，橘色针织配牛仔，秋天也要亮晶晶的☀️', { media: [img('ootd-amy1')], loc: '广州' }],
    ['nuannuan', '#今日穿搭# 通勤极简风，黑白灰也能穿出高级感，关键全在版型。', { media: [img('ootd-nuan1')], loc: '杭州' }],
    ['miyu', '#今日穿搭# 复古港风尝试了一下，烫了个大波浪，朋友说像电影里走出来的🎬', { media: [img('ootd-miyu1')], loc: '重庆' }],
    ['tangtang', '#今日穿搭# 运动风也能很时髦，今天这套去健身房回头率爆表。', { loc: '深圳' }],
  ],
  '养猫日记': [
    ['amy', '#养猫日记# 主子今天又把我的键盘当床了，敲代码全靠它心情好坏🐱', { media: [img('cat-amy1')], loc: '广州' }],
    ['nuannuan', '#养猫日记# 新来的小奶猫终于肯让我摸肚皮了，三天的罐头没白买。', { media: [img('cat-nuan1')], loc: '杭州' }],
    ['miyu', '#养猫日记# 凌晨四点被踩奶叫醒，气得想笑。养猫人的快乐与痛苦总是并存。', { loc: '重庆' }],
    ['yanyu', '#养猫日记# 带主子去做了绝育，回来后委屈巴巴地盯着我，心都化了。', { media: [img('cat-yan1')], loc: '厦门' }],
  ],
  '周末去哪儿': [
    ['tangtang', '#周末去哪儿# 周末爬了趟香山，腿废了但值得，秋天的红叶真的绝🍁', { media: [img('trip-tt1')], loc: '北京' }],
    ['zhaoyun', '#周末去哪儿# 临时起意去了趟古镇，避开人潮的清晨最舒服，随手都是片。', { media: [img('trip-zy1'), img('trip-zy2')], loc: '成都' }],
    ['boss', '#周末去哪儿# 带娃去了海洋馆，他比我还兴奋。建议工作日去，人少体验好。', { loc: '上海' }],
    ['amy', '#周末去哪儿# 城郊露营初体验，支帐篷翻车现场，但夜里的星空治愈一切✨', { media: [img('camp-amy1')], loc: '广州' }],
  ],
  '健身打卡': [
    ['tangtang', '#健身打卡# 今天练腿，深蹲又加了 5 公斤，明天大概率下不了床🦵', { loc: '深圳' }],
    ['yanyu', '#健身打卡# 晨跑五公里，海边日出配速 6 分整，一整天都是清醒的。', { media: [img('run-yan1')], loc: '厦门' }],
    ['boss', '#健身打卡# 中年人的自律：再忙也要撸铁半小时，体检报告才是最贵的奢侈品。', { loc: '上海' }],
  ],
  '胶片摄影': [
    ['zhaoyun', '#胶片摄影# 这卷 Portra 400 的肤色实在太舒服，数码真的调不出这味道。', { media: [img('film-zy1'), img('film-zy2')], loc: '成都' }],
    ['yanyu', '#胶片摄影# 旧相机扫街第七天，废片一堆，但偶尔一张就够开心一整天。', { media: [img('film-yan1')], loc: '厦门' }],
    ['miyu', '#胶片摄影# 给自己拍了组傍晚的逆光，颗粒感和漏光都成了惊喜。', { media: [img('film-miyu1')], loc: '重庆' }],
  ],
};

const BOARD_THREADS = {
  tech: [
    ['boss', 'AI 编程助手用了半年，说说它真正改变了什么', '不是替代，而是把我从重复劳动里解放出来。但 review 比以前更重要了，分享几个踩坑与最佳实践……', { elite: 1 }],
    ['coder_k', '聊聊你们团队的代码规范是怎么落地的？', 'lint + prettier + CI 卡点，但人肉 review 还是绕不开。大家有什么自动化的好办法吗？'],
  ],
  talk: [
    ['amy', '大家平时都用什么 App 记录灵感？求安利', '试过好几个笔记软件总是坚持不下来，想看看大家的灵感收集习惯～'],
    ['nuannuan', '一个人住久了，你养成了哪些治愈自己的小习惯？', '我是每天睡前点支香薰、写三行日记。说说你们的，互相取取暖🫶'],
  ],
  newbie: [
    ['miyu', '插画新人报到～接稿中，欢迎勾搭', '画龄三年，主攻治愈系和国风，最近在练板绘。希望在这认识同好，一起进步！', { media: [img('newbie-miyu')] }],
    ['gugu', '萌新报到，是个折腾桌搭和外设的硬件党', '潜水很久了终于来报到，主玩客制化键盘，有问题随时交流配置～'],
  ],
  complain: [
    ['yanyu', '吐槽：为什么手机厂商越来越喜欢挤牙膏？', '换了新机感知最强的居然是更大更亮的广告，真正的体验提升越来越少了，是我要求高了吗？'],
    ['laozhang', '通勤一小时的人路过，吐槽下早高峰地铁', '挤到怀疑人生，但摸鱼刷到一条好笑的帖子又满血复活了。打工人的快乐就这么朴实。'],
  ],
  backend: [
    ['coder_k', '缓存一致性这道坎，你们是怎么过的？', '更新数据库再删缓存 vs 延迟双删，生产里到底哪种更稳？说说你们的实践和翻车经历。', { elite: 1 }],
    ['laozhang', '小团队该不该上微服务？我的几点反思', '为了赶时髦上了微服务，结果运维成本翻倍。复盘下：什么阶段、什么规模才真正需要拆。'],
  ],
  hobby: [
    ['amy', '入坑手冲咖啡三个月，分享我的器具清单和心得', '从一团乱到能稳定出一杯好喝的，踩了不少坑。附器具清单和参数，新手可抄作业☕️', { media: [img('coffee-amy1')] }],
  ],
  market: [
    ['gugu', '出 95 新机械键盘一把，自用换车位', 'Gateron 轴，附原包装与备用键帽，成色很新，价格私聊，同城面交优先。', { media: [img('kb-gugu1')] }],
    ['zhaoyun', '转一台九成新二手胶片机，带原装镜头', '入了新机器，这台闲置了，快门成色都很好，适合新手入门，有意私信看实拍。'],
  ],
};

// ---- bookmarks: give showcase accounts a populated 收藏 tab ----
const insBookmark = db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, post_id, created_at) VALUES (?,?,?)');
const BOOKMARK_USERS = ['linmu', 'amy', 'tangtang', 'nuannuan', 'coder_k', 'boss'];

// ---- gift mall items so showcase profiles show 头衔/头像框 and 我的兑换 isn't empty ----
const GIFTS = [
  ['linmu', 3], ['linmu', 4],   // 锦鲤 头衔 + 彩虹头像框
  ['amy', 2], ['amy', 4],       // 夜猫子 头衔 + 彩虹头像框
  ['boss', 1], ['boss', 5],     // 社区元老 头衔 + 鎏金头像框
  ['admin', 1], ['admin', 5],   // 站长：社区元老 + 鎏金头像框
  ['coder_k', 2],               // 夜猫子 头衔
  ['tangtang', 4],              // 彩虹头像框
  ['linmu', 7],                 // 改名卡（演示消耗道具）
  ['linmu', 6],                 // 全站置顶卡（演示消耗道具）
];

// ---- thread replies: forum threads show high counts but had ~1 actual reply ----
const insTReply = db.prepare('INSERT INTO comments (thread_id,user_id,content,like_count,created_at) VALUES (?,?,?,?,?)');
const REPLY_USERS = ['linmu', 'amy', 'tangtang', 'nuannuan', 'coder_k', 'boss', 'zhaoyun', 'gugu', 'yanyu', 'miyu', 'laozhang'];
const REPLY_POOL = [
  '说得太对了，学到了👍', '支持楼主，写得很用心', '前排围观，马住慢慢看', '感谢分享，正好需要',
  '有点道理，受教了', '同问，蹲一个后续', '插眼，等更新～', '楼主是好人，已关注',
  '这个角度挺新颖的', '亲测有效，给楼主点赞', '收藏了，慢慢消化', '路过留个脚印🐾',
  '深有同感，顶上去', '讲得很清楚，赞一个', '我也遇到过，确实是这样', '期待楼主多发点干货',
];

// ---- notifications: every showcase account should have a lively 通知 center ----
const insNotif = db.prepare('INSERT INTO notifications (user_id,actor_id,type,target_type,target_id,preview,read,created_at) VALUES (?,?,?,?,?,?,?,?)');
const insFollow = db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?,?,?)');
const SHOWCASE_NOTIF = ['linmu', 'amy', 'tangtang', 'nuannuan', 'coder_k', 'boss', 'admin'];
const CMT_PREVIEW = ['写得真好，学到了👍', '这条好治愈，已收藏～', '拍得真好看，求参数', '每次都很有灵感✨', '太喜欢这个风格了'];

// ---- topic follows: give showcase accounts followed topics (discover page surfaces them) ----
const insTopicFollow = db.prepare('INSERT OR IGNORE INTO topic_follows (user_id, topic_id, created_at) VALUES (?,?,?)');
const TOPIC_FOLLOWS = {
  linmu: ['今日穿搭', '胶片摄影', '治愈系风景', '读书笔记'],
  amy: ['宅家美食', '养猫日记', '今日穿搭'],
  tangtang: ['健身打卡', '周末去哪儿'],
  nuannuan: ['养猫日记', '治愈系风景', '读书笔记'],
  coder_k: ['程序员日常', '副业搞钱'],
  boss: ['副业搞钱', '程序员日常'],
};

// ---- a deep reply chain on one post so the "展开 N 条回复" fold is demoable ----
const insPostReply = db.prepare('INSERT INTO comments (post_id,user_id,parent_id,reply_to,content,like_count,created_at) VALUES (?,?,?,?,?,?,?)');
const CHAIN_POOL = ['哈哈哈同感', '楼上说得对👍', '+1，我也这么觉得', '受教了🙏', '学到了', '蹲一个后续', '说得太好了', '握手，同好'];

// ---- demo feedback + official replies (问题反馈板块) ----
const insFb = db.prepare('INSERT INTO feedback (user_id, content, status, reply, replied_at, created_at) VALUES (?,?,?,?,?,?)');
const DEMO_FB = [
  ['amy', '希望增加圈子功能，可以自己建兴趣社群一起玩～', 'planned', '已采纳！圈子已排进开发计划，敬请期待 🙌', 2],
  ['coder_k', '动态能不能支持投票和问答这种富内容？', 'planned', '投票 / 问答已列入富内容计划中，会尽快上线。', 3],
  ['tangtang', '移动端能不能禁止页面随意缩放，体验更像 App', 'resolved', '已修复，现在移动端已锁定缩放、消除横向溢出。', 1],
  ['nuannuan', '排行榜什么时候有呀，想看看谁最活跃～', 'resolved', '排行榜已经上线啦，去左侧「排行榜」看看吧 🏆', 0],
  ['boss', '深色模式下个别地方对比度还能再高一点', 'doing', '正在逐页打磨 light/dark 双模式，感谢反馈，已记录。', 4],
];

// ---- 资讯快报演示数据 ----
const insFlash = db.prepare('INSERT INTO flash (title, summary, category, pinned, created_at) VALUES (?,?,?,?,?)');
const DEMO_FLASH = [
  ['HahaSNS 全新上线，欢迎来到轻社区', '动态 / 话题 / 论坛 / 私信 / 签到 / 积分，一站式轻社交体验', '公告', 1],
  ['社区排行榜上线', '财富 / 等级 / 人气 / 签到 四大榜单，看看谁最活跃', '功能', 0],
  ['6 套主题配色 × 明暗模式', '导航栏调色盘一键换肤，经典蓝 / 锐紫 / 翡翠 随心切换', '功能', 0],
  ['#今日穿搭# 话题征集中', '分享你的每日 OOTD，优质内容有机会上首页精选', '活动', 0],
  ['本周高赞：那些治愈系风景', '点开看看社区里最受欢迎的风景大片', '精选', 0],
  ['新手指南：如何快速涨粉', '完善资料、坚持发优质内容、多多互动', '教程', 0],
  ['楼中楼回复 & 评论排序上线', '盖楼更清晰，评论支持「最新 / 最热」切换', '功能', 0],
  ['签到打卡赢积分', '连续签到积分翻倍，兑换专属头衔与头像框', '活动', 0],
  ['私信支持图片 / 表情 / 已读回执', '聊天体验再升级，还能置顶与免打扰', '功能', 0],
  ['问题反馈通道已开', '在「更新日志」页提交 bug 与建议，我们逐条回复', '公告', 0],
  ['论坛热帖：前端框架怎么选', '2026 年了，你还在用什么前端框架？来论坛聊聊', '精选', 0],
  ['积分商城上新', '彩虹 / 鎏金头像框、限定头衔，等你来兑换', '活动', 0],
];

// 圈子 demo — [name, description, category, color, icon, ownerUsername]
const DEMO_CIRCLES = [
  ['摄影爱好者', '一起记录光影与日常，分享你的取景与后期心得', '兴趣', '#0e8fb8', 'camera', 'amy'],
  ['前端搬砖日记', 'React / Vue / 工程化 / 面试，前端er 的交流地', '科技', '#2b54f0', 'code', 'boss'],
  ['今天也要好好吃饭', '探店、菜谱、深夜放毒，吃货集合！', '生活', '#ef6c12', 'fire', 'amy'],
  ['独立开发者俱乐部', '从 0 到 1 做产品，副业、出海、变现经验交流', '科技', '#059f76', 'rocket', 'boss'],
  ['猫猫狗狗后援会', '晒娃（毛孩子）专用，云吸宠也欢迎', '生活', '#e11d6b', 'heart', 'amy'],
  ['周末去哪儿', '同城活动、徒步露营、展览演出，约起来', '同城', '#7c3aed', 'compass', 'boss'],
  ['手帐与文具控', '拼贴、胶带、钢笔墨水，治愈系手作分享', '创作', '#f59e0b', 'edit', 'amy'],
  ['深夜书房', '读书笔记、好书推荐、共读打卡', '兴趣', '#0ea5e9', 'book', 'boss'],
];
const insCircle = db.prepare(`INSERT INTO circles (name, slug, description, category, color, icon, owner_id, member_count, post_count, created_at)
  VALUES (@name,@slug,@desc,@cat,@color,@icon,@owner,@mc,@pc,@created)`);
const insCircleMember = db.prepare("INSERT OR IGNORE INTO circle_members (circle_id, user_id, role, joined_at) VALUES (?,?,?,?)");
const slugify = (s) => (s || '').toLowerCase().replace(/[^\w一-龥]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const ALL_UNAMES = Object.keys(ids);

// 投票 demo — [author, question, options[], multi]
const DEMO_POLLS = [
  ['amy', '2026 年你最看好的前端框架是？', ['React', 'Vue', 'Svelte', 'Solid'], false],
  ['boss', '周末你更想怎么过？', ['宅家躺平充电', '出门暴走拍照', '约朋友聚会', '搞点副业'], false],
  ['amy', '深色还是浅色，你站哪边？', ['全程深色党', '全程浅色党', '跟随系统', '看心情随时切'], false],
  ['boss', '下半年想重点提升哪些能力？（多选）', ['英语', '理财', '健身', '写作', '编程'], true],
  ['amy', '点外卖时最看重什么？', ['味道好', '出餐快', '价格实惠', '包装干净'], false],
];
const insPoll = db.prepare('INSERT INTO polls (post_id, multi, deadline, total_votes, created_at) VALUES (?,?,?,?,?)');
const insPollOpt = db.prepare('INSERT INTO poll_options (poll_id, text, votes, idx) VALUES (?,?,?,?)');
const insPollVote = db.prepare('INSERT OR IGNORE INTO poll_votes (poll_id, option_id, user_id, created_at) VALUES (?,?,?,?)');

// 问答 demo — [asker, title, body, category, bounty, answers[[user,content,votes]], acceptedIdx]
const DEMO_QA = [
  ['amy', '新手想学前端，2026 年该从哪条路线入手？', '完全零基础，想系统学一下，求一个不绕弯的学习顺序和资源推荐。', '技术', 50,
    [['boss', 'HTML/CSS → JavaScript 基础 → 一个框架（React 或 Vue 选一个深入）→ 工程化（Vite、TS）。别一上来就追新，把 JS 打牢最重要。', 23],
     ['amy', '推荐 MDN + 一个完整项目驱动学习，做出东西成就感最强。', 8]], 0],
  ['boss', '租房时押一付三，中介费能砍价吗？', '第一次租房，怕被坑，想听听有经验的朋友怎么谈的。', '生活', 20,
    [['amy', '中介费一般可以谈到半个月，旺季难一点。签合同前一定逐条看清违约条款。', 15]], -1],
  ['amy', '工作三年陷入瓶颈，要不要跳槽换方向？', '现在做后端，有点想转产品，但担心从零开始。大家怎么看？', '职场', 100,
    [['boss', '先在现公司找机会接触产品工作，验证兴趣再跳，风险更低。', 31],
     ['amy', '32 岁前可以试错，想清楚自己图什么最关键。', 12]], -1],
  ['boss', '有没有适合通勤听的中文播客推荐？', '每天通勤一小时，想听点有营养又不费脑的。', '生活', 0,
    [['amy', '《故事 FM》《忽左忽右》都不错，看你口味偏纪实还是闲聊。', 9]], -1],
  ['amy', 'MacBook 内存 16G 够用吗，做开发的话？', '主要写前端，偶尔跑跑 Docker，纠结要不要上 32G。', '数码', 30,
    [['boss', '纯前端 16G 够用；但如果经常多开 Docker + 虚拟机，32G 更稳，预算够建议一步到位。', 18]], 0],
];
const insQuestion = db.prepare('INSERT INTO questions (user_id, title, body, category, bounty, status, best_answer_id, answer_count, view_count, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
const insAnswer = db.prepare('INSERT INTO answers (question_id, user_id, content, vote_count, accepted, created_at) VALUES (?,?,?,?,?,?)');

// 导航 demo — [category, icon, links[[title, url, desc, color]]] — real, recognizable sites
const DEMO_NAV = [
  ['开发者', 'code', [
    ['GitHub', 'https://github.com', '全球最大的代码托管与协作平台', '#24292f'],
    ['MDN Web Docs', 'https://developer.mozilla.org', 'Web 技术权威参考文档', '#1a1a1a'],
    ['Stack Overflow', 'https://stackoverflow.com', '程序员问答社区', '#f48024'],
    ['Can I use', 'https://caniuse.com', '浏览器特性兼容性查询', '#e8730f'],
    ['CodePen', 'https://codepen.io', '前端代码在线演练场', '#1a1a1a'],
    ['npm', 'https://www.npmjs.com', 'Node 包检索与管理', '#cb3837'],
    ['Vite', 'https://vitejs.dev', '下一代前端构建工具', '#646cff'],
    ['React', 'https://react.dev', 'React 官方文档', '#087ea4'],
  ]],
  ['设计资源', 'palette', [
    ['Figma', 'https://figma.com', '协作式界面设计工具', '#a259ff'],
    ['Dribbble', 'https://dribbble.com', '设计作品灵感社区', '#ea4c89'],
    ['unDraw', 'https://undraw.co', '免费可商用矢量插画', '#6c63ff'],
    ['Coolors', 'https://coolors.co', '快速生成配色方案', '#0d99ff'],
    ['Google Fonts', 'https://fonts.google.com', '免费开源字体库', '#4285f4'],
    ['Iconify', 'https://icon-sets.iconify.design', '海量开源图标检索', '#1769aa'],
  ]],
  ['学习成长', 'book', [
    ['掘金', 'https://juejin.cn', '中文技术内容社区', '#1e80ff'],
    ['freeCodeCamp', 'https://www.freecodecamp.org', '免费编程学习平台', '#0a0a23'],
    ['Coursera', 'https://www.coursera.org', '名校在线课程', '#0056d2'],
    ['哔哩哔哩', 'https://www.bilibili.com', '学习区宝藏视频', '#fb7299'],
    ['极客时间', 'https://time.geekbang.org', 'IT 职业技能课程', '#2c64ff'],
  ]],
  ['效率工具', 'rocket', [
    ['Notion', 'https://notion.so', '全能笔记与协作空间', '#1a1a1a'],
    ['Excalidraw', 'https://excalidraw.com', '手绘风在线白板', '#6965db'],
    ['TinyPNG', 'https://tinypng.com', '智能图片压缩', '#16a085'],
    ['Regex101', 'https://regex101.com', '正则表达式在线测试', '#3a7bd5'],
    ['Carbon', 'https://carbon.now.sh', '生成漂亮的代码截图', '#fd5750'],
  ]],
  ['AI 工具', 'smile', [
    ['Claude', 'https://claude.ai', '强大的 AI 助手', '#d97757'],
    ['Hugging Face', 'https://huggingface.co', '开源 AI 模型社区', '#ff9d00'],
    ['Perplexity', 'https://www.perplexity.ai', 'AI 搜索引擎', '#20808d'],
    ['Midjourney', 'https://www.midjourney.com', 'AI 绘画生成', '#1a1a1a'],
  ]],
  ['灵感发现', 'fire', [
    ['Product Hunt', 'https://www.producthunt.com', '每日新产品发现', '#da552f'],
    ['Hacker News', 'https://news.ycombinator.com', '科技与创业资讯', '#ff6600'],
    ['少数派', 'https://sspai.com', '高质量数字生活指南', '#d70010'],
    ['V2EX', 'https://www.v2ex.com', '创意工作者社区', '#2b3137'],
  ]],
];
const insNavCat = db.prepare('INSERT INTO nav_categories (name, icon, position) VALUES (?,?,?)');
const insNavLink = db.prepare('INSERT INTO nav_links (category_id, title, url, description, color, clicks, position) VALUES (?,?,?,?,?,?,?)');

let nPosts = 0, nThreads = 0, nBookmarks = 0, nOrders = 0, nReplies = 0, nNotifs = 0, nTopicFollows = 0, nChain = 0, nFb = 0, nFlash = 0, nCircles = 0, nPolls = 0, nQA = 0, nNav = 0;
const TOPIC_TARGET = 3, BOARD_TARGET = 2, BOOKMARK_TARGET = 5;

const tx = db.transaction(() => {
  for (const [name, bank] of Object.entries(TOPIC_POSTS)) {
    const tid = topicIds[name];
    if (!tid) continue;
    const cur = db.prepare('SELECT post_count c FROM topics WHERE id=?').get(tid).c;
    let need = Math.max(0, TOPIC_TARGET - cur);
    for (const [user, content, o] of bank) {
      if (need <= 0) break;
      if (!ids[user]) continue;
      addPost(user, content, { ...o, topic: name });
      need--; nPosts++;
    }
  }
  for (const [slug, bank] of Object.entries(BOARD_THREADS)) {
    const bid = boardIds[slug];
    if (!bid) continue;
    const cur = db.prepare('SELECT thread_count c FROM boards WHERE id=?').get(bid).c;
    let need = Math.max(0, BOARD_TARGET - cur);
    for (const [user, title, content, o] of bank) {
      if (need <= 0) break;
      if (!ids[user]) continue;
      addThread(slug, user, title, content, o || {});
      need--; nThreads++;
    }
  }
  for (const uname of BOOKMARK_USERS) {
    const uid = ids[uname];
    if (!uid) continue;
    if (db.prepare('SELECT COUNT(*) c FROM bookmarks WHERE user_id=?').get(uid).c >= 3) continue;
    const picks = db.prepare(`SELECT id FROM posts WHERE user_id != ? AND visibility='public'
      ORDER BY like_count DESC, id DESC LIMIT ?`).all(uid, BOOKMARK_TARGET);
    for (const p of picks) {
      if (insBookmark.run(uid, p.id, daysAgo(rnd(1, 12), rnd(0, 20))).changes) nBookmarks++;
    }
  }
  for (const [uname, pid] of GIFTS) {
    const uid = ids[uname];
    if (!uid) continue;
    const prod = db.prepare('SELECT * FROM products WHERE id=?').get(pid);
    if (!prod) continue;
    if (db.prepare('SELECT 1 FROM orders WHERE user_id=? AND product_id=?').get(uid, pid)) continue; // idempotent
    db.prepare('INSERT INTO orders (user_id, product_id, price, created_at) VALUES (?,?,?,?)').run(uid, pid, prod.price, daysAgo(rnd(2, 25)));
    db.prepare('UPDATE products SET sold = sold + 1 WHERE id=?').run(pid);
    if (prod.category === 'title' && prod.payload) db.prepare('UPDATE users SET title=? WHERE id=?').run(prod.payload, uid);
    if (prod.category === 'frame' && prod.payload) db.prepare('UPDATE users SET avatar_frame=? WHERE id=?').run(prod.payload, uid);
    nOrders++;
  }
  // populate forum thread discussions and sync reply_count to what's actually shown
  for (const t of db.prepare('SELECT id, user_id FROM threads').all()) {
    const cur = db.prepare('SELECT COUNT(*) c FROM comments WHERE thread_id=?').get(t.id).c;
    if (cur >= 5) continue;
    const target = 6 + (t.id % 7); // 6–12 replies, varied per thread
    for (let i = cur; i < target; i++) {
      const uname = REPLY_USERS[(t.id * 3 + i * 7) % REPLY_USERS.length];
      const uid = ids[uname];
      if (!uid || uid === t.user_id) continue;
      const content = REPLY_POOL[(t.id * 5 + i * 3) % REPLY_POOL.length];
      insTReply.run(t.id, uid, content, rnd(0, 18), daysAgo(rnd(0, 3), rnd(0, 23)));
      nReplies++;
    }
    const total = db.prepare('SELECT COUNT(*) c FROM comments WHERE thread_id=?').get(t.id).c;
    const last = db.prepare('SELECT MAX(created_at) m FROM comments WHERE thread_id=?').get(t.id).m;
    db.prepare('UPDATE threads SET reply_count=?, last_reply_at=COALESCE(?, last_reply_at) WHERE id=?').run(total, last, t.id);
  }
  for (const uname of SHOWCASE_NOTIF) {
    const uid = ids[uname];
    if (!uid) continue;
    if (db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=?').get(uid).c >= 6) continue;
    const myPosts = db.prepare('SELECT id FROM posts WHERE user_id=? LIMIT 5').all(uid).map(r => r.id);
    if (!myPosts.length) continue;
    const actors = REPLY_USERS.filter(a => a !== uname && ids[a]);
    for (let i = 0; i < 7; i++) { // likes
      insNotif.run(uid, ids[actors[i % actors.length]], 'like', 'post', myPosts[i % myPosts.length], '', i < 4 ? 0 : 1, daysAgo(rnd(0, 6), rnd(0, 23))); nNotifs++;
    }
    for (let i = 0; i < 3; i++) { // comments
      insNotif.run(uid, ids[actors[(i + 2) % actors.length]], 'comment', 'post', myPosts[i % myPosts.length], CMT_PREVIEW[(uid + i) % CMT_PREVIEW.length], i < 2 ? 0 : 1, daysAgo(rnd(0, 5), rnd(0, 23))); nNotifs++;
    }
    for (let i = 0; i < 4; i++) { // follows (+ real follow rows so counts stay consistent)
      const a = ids[actors[(i + 4) % actors.length]];
      insFollow.run(a, uid, daysAgo(rnd(0, 8)));
      insNotif.run(uid, a, 'follow', 'user', a, '', i < 1 ? 0 : 1, daysAgo(rnd(0, 5), rnd(0, 23))); nNotifs++;
    }
    insNotif.run(uid, ids[actors[actors.length - 1]], 'reward', 'post', myPosts[0], '打赏了你 30 积分 🎁', 0, daysAgo(rnd(0, 3), rnd(0, 23))); nNotifs++;
  }
  for (const [uname, tnames] of Object.entries(TOPIC_FOLLOWS)) {
    const uid = ids[uname];
    if (!uid) continue;
    for (const tn of tnames) {
      const tid = topicIds[tn];
      if (tid && insTopicFollow.run(uid, tid, daysAgo(rnd(1, 15))).changes) nTopicFollows++;
    }
  }
  const root = db.prepare('SELECT id, post_id, user_id FROM comments WHERE post_id IS NOT NULL AND parent_id IS NULL ORDER BY id LIMIT 1').get();
  if (root && db.prepare('SELECT COUNT(*) c FROM comments WHERE parent_id=?').get(root.id).c < 4) {
    const ru = REPLY_USERS.filter(a => ids[a]);
    for (let i = 0; i < 6; i++) {
      insPostReply.run(root.post_id, ids[ru[i % ru.length]], root.id, root.user_id, CHAIN_POOL[i % CHAIN_POOL.length], rnd(0, 8), daysAgo(rnd(0, 3), rnd(0, 23)));
      nChain++;
    }
    db.prepare('UPDATE posts SET comment_count = (SELECT COUNT(*) FROM comments WHERE post_id=?) WHERE id=?').run(root.post_id, root.post_id);
  }
  if (db.prepare('SELECT COUNT(*) c FROM feedback').get().c < 3) {
    for (const [uname, content, status, reply, d] of DEMO_FB) {
      if (!ids[uname]) continue;
      insFb.run(ids[uname], content, status, reply, daysAgo(d), daysAgo(d, 2));
      nFb++;
    }
  }
  if (db.prepare('SELECT COUNT(*) c FROM flash').get().c === 0) {
    DEMO_FLASH.forEach(([title, summary, category, pinned], i) => {
      insFlash.run(title, summary, category, pinned, daysAgo(i, rnd(0, 20)));
      nFlash++;
    });
  }
  // 圈子：建圈 + 成员 + 把一批现有动态归入圈子，让每个圈子都有内容
  if (db.prepare('SELECT COUNT(*) c FROM circles').get().c === 0 && ALL_UNAMES.length) {
    DEMO_CIRCLES.forEach(([name, desc, cat, color, icon, owner], i) => {
      if (!ids[owner]) return;
      const memberCount = rnd(180, 1400);
      const created = daysAgo(rnd(20, 90), rnd(0, 23));
      const info = insCircle.run({ name, slug: slugify(name) || `c-${i}`, desc, cat, color, icon, owner: ids[owner], mc: 1, pc: 0, created });
      const cid = info.lastInsertRowid;
      insCircleMember.run(cid, ids[owner], 'owner', created);
      // pull a varied sample of real members
      const sample = [...ALL_UNAMES].sort(() => Math.random() - 0.5).slice(0, Math.min(40, ALL_UNAMES.length));
      let real = 1;
      for (const uname of sample) {
        if (uname === owner) continue;
        insCircleMember.run(cid, ids[uname], 'member', daysAgo(rnd(0, 60), rnd(0, 23)));
        real++;
      }
      // claim ~6 recent public posts (by members) into this circle as its feed
      const claim = db.prepare(`SELECT id FROM posts WHERE circle_id IS NULL AND visibility='public'
        ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(6, i * 6);
      claim.forEach((p) => db.prepare('UPDATE posts SET circle_id=? WHERE id=?').run(cid, p.id));
      db.prepare('UPDATE circles SET member_count=?, post_count=? WHERE id=?')
        .run(Math.max(memberCount, real), claim.length, cid);
      nCircles++;
    });
  }
  // 投票：发起投票动态 + 预置一批真实投票，让结果有看头
  if (db.prepare('SELECT COUNT(*) c FROM polls').get().c === 0 && ALL_UNAMES.length) {
    DEMO_POLLS.forEach(([author, q, opts, multi], i) => {
      if (!ids[author]) return;
      const created = daysAgo(rnd(0, 5), rnd(0, 22));
      const pInfo = insPost.run({
        user: ids[author], content: q, media: '[]', mtype: 'text', vis: 'public', price: 0,
        loc: '', device: Math.random() > 0.5 ? '手机端' : '电脑端', topic: null,
        views: rnd(300, 4000), likes: rnd(10, 120), shares: rnd(0, 9), created,
      });
      const pollInfo = insPoll.run(pInfo.lastInsertRowid, multi ? 1 : 0, null, 0, created);
      const optIds = opts.map((t, idx) => insPollOpt.run(pollInfo.lastInsertRowid, t, 0, idx).lastInsertRowid);
      // cast votes from a random sample of users
      const voters = [...ALL_UNAMES].sort(() => Math.random() - 0.5).slice(0, rnd(30, Math.min(160, ALL_UNAMES.length)));
      let totalVoters = 0;
      for (const v of voters) {
        const picks = multi
          ? optIds.filter(() => Math.random() < 0.4).slice(0, 3)
          : [optIds[rnd(0, optIds.length - 1)]];
        const chosen = picks.length ? picks : [optIds[0]];
        for (const oid of chosen) {
          insPollVote.run(pollInfo.lastInsertRowid, oid, ids[v], daysAgo(rnd(0, 4), rnd(0, 23)));
          db.prepare('UPDATE poll_options SET votes = votes + 1 WHERE id=?').run(oid);
        }
        totalVoters++;
      }
      db.prepare('UPDATE polls SET total_votes=? WHERE id=?').run(totalVoters, pollInfo.lastInsertRowid);
      nPolls++;
    });
  }
  // 问答：提问 + 回答 + 采纳（演示）
  if (db.prepare('SELECT COUNT(*) c FROM questions').get().c === 0 && ALL_UNAMES.length) {
    DEMO_QA.forEach(([asker, title, body, cat, bounty, ans, acceptedIdx], i) => {
      if (!ids[asker]) return;
      const created = daysAgo(rnd(1, 8), rnd(0, 22));
      const solved = acceptedIdx >= 0;
      const qInfo = insQuestion.run(ids[asker], title, body, cat, bounty, solved ? 'solved' : 'open', null, ans.length, rnd(80, 1600), created);
      const qid = qInfo.lastInsertRowid;
      let bestId = null;
      ans.forEach(([u, content, votes], ai) => {
        if (!ids[u]) return;
        const accepted = ai === acceptedIdx ? 1 : 0;
        const aInfo = insAnswer.run(qid, ids[u], content, votes, accepted, daysAgo(rnd(0, 6), rnd(0, 22)));
        if (accepted) bestId = aInfo.lastInsertRowid;
      });
      if (bestId) db.prepare('UPDATE questions SET best_answer_id=? WHERE id=?').run(bestId, qid);
      nQA++;
    });
  }
  // 导航：分类 + 链接（真实站点）
  if (db.prepare('SELECT COUNT(*) c FROM nav_categories').get().c === 0) {
    DEMO_NAV.forEach(([name, icon, links], ci) => {
      const cInfo = insNavCat.run(name, icon, ci);
      links.forEach(([title, url, desc, color], li) => {
        insNavLink.run(cInfo.lastInsertRowid, title, url, desc, color, rnd(40, 3200), li);
      });
      nNav++;
    });
  }
});
tx();

console.log(`seed-extra: added ${nPosts} topic posts, ${nThreads} forum threads, ${nBookmarks} bookmarks, ${nOrders} mall orders, ${nReplies} thread replies, ${nNotifs} notifications, ${nTopicFollows} topic follows, ${nChain} reply-chain, ${nCircles} circles, ${nPolls} polls, ${nQA} questions, ${nNav} nav-cats`);
