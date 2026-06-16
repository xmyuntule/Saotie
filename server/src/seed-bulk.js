// Idempotent bulk demo-data generator — scales toward N users / M posts with
// all-encompassing content. Additive & idempotent: only creates the delta to
// reach the targets, so re-running is a no-op once at target.
//   node src/seed-bulk.js [users] [posts]
import bcrypt from 'bcryptjs';
import db from './db.js';

const TARGET_USERS = Number(process.argv[2]) || 1000;
const TARGET_POSTS = Number(process.argv[3]) || 10000;

const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (d, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString().slice(0, 19).replace('T', ' ');
const img = (s) => `https://picsum.photos/seed/${s}/800/600`;
const pw = bcrypt.hashSync(process.env.SEED_PASSWORD || 'hahasns123', 10);

// ---- name generation (varied, readable Chinese nicknames) ----
const NICK_A = ['小', '大', '阿', '老', '一只', '是', '会飞的', '爱睡的', '住在海边的', '隔壁', '深夜', '元气', '柠檬', '芒果', '可乐', '布丁', '奶油', '咸鱼', '不困的', '想退休的', '迷路的', '佛系', '电量不足的', '今天也', ''];
const NICK_B = ['林', '陈', '苏', '江', '安', '夏', '顾', '沈', '白', '温', '南', '叶', '池', '简', '楚', '宋', '车', '七', '鹿', '云', '星', '河', '木', '糖', '阿球', '土豆', '团子', '猫', '阿白', '麦子'];
const NICK_C = ['同学', '在路上', '的日常', '本人', 'momo', '233', '不加班', '想搞钱', '爱摄影', '减肥中', '在coding', '看海去了', '写代码的', '画画的', '种花的', 'er', '酱', '叔', '小姐', '', '', ''];
const CITY = ['北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '武汉', '南京', '西安', '苏州', '长沙', '青岛', '厦门', '天津', '郑州', '昆明', '合肥', '福州', '济南', '大理', '珠海', ''];
const PRAV = [11, 12, 13, 14, 15, 16, 22, 25, 28, 31, 32, 33, 36, 41, 44, 45, 47, 48, 51, 52, 56, 60, 63, 65, 68];
const BIOS = ['记录普通而具体的生活。', '热爱生活的每一个瞬间。', '一半是海水，一半是火焰。', '认真摸鱼，努力生活。', '分享有用和有趣的东西。', '在自己的节奏里慢慢来。', '今天也要元气满满呀。', '专注内容，少废话。', '想成为有趣的人。', '人间值得，继续加油。', '热爱摄影 / 美食 / 旅行。', '一个爱折腾的普通人。', ''];

// ---- content pools by category (maps to existing topics where sensible) ----
const CATS = [
  { t: '宅家美食', s: ['今天复刻了一道隐藏菜单，意外地好吃！', '深夜放毒：自制麻辣香锅，越吃越上头🌶️', '减脂期也能吃得很满足，分享我的低卡食谱。', '周末在家煮了一锅暖暖的关东煮，幸福感拉满。', '探店了一家巷子里的小馆子，人均30吃到撑。', '学会了拉花，第一次居然成功了☕️'] },
  { t: '周末去哪儿', s: ['周末爬山看了日出，所有疲惫都值了。', '说走就走，临时去了趟古镇，避开人潮真舒服。', '城市周边露营初体验，星空治愈一切✨', '逛了一下午美术馆，被一幅画看哭了。', '骑行30公里到了海边，风把烦恼都吹散了。', '带娃去了趟海洋馆，他比我还兴奋。'] },
  { t: '今日穿搭', s: ['今日多巴胺穿搭，秋天也要亮晶晶☀️', '通勤极简风，黑白灰也能穿出高级感。', '挖到一件神仙大衣，版型绝了。', '复古港风尝试，朋友说像电影里走出来的。', '运动风也能很时髦，回头率超高。', '换季断舍离，只留下真正爱穿的。'] },
  { t: '养猫日记', s: ['主子今天又把键盘当床了，敲代码全靠它心情🐱', '新来的小奶猫终于肯让我摸肚皮了。', '凌晨四点被踩奶叫醒，气得想笑。', '带猫做了绝育，回来委屈巴巴地盯着我。', '猫薄荷一撒，瞬间变成憨憨。', '撸猫一时爽，铲屎火葬场，但还是很爱。'] },
  { t: '程序员日常', s: ['调了一下午的bug，最后发现是少写了分号。', '上线前夜，许愿不要回滚🙏', '重构完老代码，整个人都通透了。', '今天又被产品的需求整不会了。', '终于把那个性能问题优化掉了，快了10倍！', '周五部署，是想体验加班的快乐吗？'] },
  { t: '健身打卡', s: ['今天练腿，深蹲加了5公斤，明天大概率下不了床🦵', '晨跑五公里，一整天都是清醒的。', '坚持健身第100天，自律真的会上瘾。', '今天的训练计划，需要的扣1。', '中年人的自律：再忙也要撸铁半小时。', '体脂又降了1个点，继续冲！'] },
  { t: '胶片摄影', s: ['这卷Portra400的肤色太舒服，数码调不出。', '旧相机扫街第七天，废片一堆但很快乐。', '逆光下的傍晚，颗粒感成了惊喜。', '入了台二手胶片机，质感绝了。', '冲洗出来的那一刻，像拆盲盒一样开心。', '光影和留白用得克制，受益匪浅。'] },
  { t: '治愈系风景', s: ['海边的风把所有烦恼都吹散了。', '今天的晚霞，像打翻了的调色盘。', '雨后的城市，干净得像刚被洗过。', '山里的清晨，安静得能听见自己的呼吸。', '路过一片花海，忍不住多拍了几张。', '什么都不做，只是发呆，也很好。'] },
  { t: '副业搞钱', s: ['副业第一个月回本了，分享我的踩坑经验。', '搞钱使我快乐，但别盲目追风口。', '下班后做点小生意，比想象中难。', '把爱好变成收入，是件很爽的事。', '记录我的第二曲线探索，慢慢来。', '认真写了一段创业复盘，很长——'] },
  { t: '读书笔记', s: ['读完《被讨厌的勇气》，整个人轻松了。', '最近在重读经典，每次都有新体会。', '分享这个月读过的五本好书。', '一本好书就像一次深度对话。', '做了点读书笔记，慢慢消化。', '纸质书的手感还是无法替代。'] },
  { t: null, s: ['今天也是平平无奇但很满足的一天。', '生活嘛，开心最重要。', '记录一下此刻的心情，很平静。', '突然就想分享一下今天的小确幸。', '努力生活的样子真好看。', '愿你我都被这个世界温柔以待。', '深夜emo一下，明天又是元气满满的一天。', '又是为生活奔波的一天，但路边的花开得真好。', '把日子过成自己喜欢的样子。', '平凡的日常里藏着很多小惊喜。'] },
  { t: null, s: ['新入手的相机/键盘/耳机，体验分享在评论区。', '关于自我成长，我有几点想法想聊聊。', '职场第三年，分享几个让我少走弯路的习惯。', '理财小白的第一笔基金定投，记录一下。', '看完这部电影，久久不能平静，推荐！', '最近循环的一首歌，单曲循环一整天🎵', '入坑手冲咖啡三个月，分享器具清单。', '收纳改造完成，房间瞬间清爽了。', '养了几盆绿植，生活都变得有生机了🌿', '周末手作了个小物件，治愈又解压。'] },
];

const VIDEO = ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'];
const TAILS = ['', '', '', ' 评论区聊聊～', ' 你们怎么看？', ' 求同好🙌', ' 已经收藏啦。', ' 周末愉快！', ' 一起加油💪', ' 记录给未来的自己。'];

// topic name -> id
const topicIds = Object.fromEntries(db.prepare('SELECT name,id FROM topics').all().map((t) => [t.name, t.id]));

const haveUsers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
const havePosts = db.prepare('SELECT COUNT(*) c FROM posts').get().c;
const needUsers = Math.max(0, TARGET_USERS - haveUsers);
const needPosts = Math.max(0, TARGET_POSTS - havePosts);

const insUser = db.prepare(`INSERT OR IGNORE INTO users
  (username,nickname,password_hash,bio,location,verified,vip,role,experience,points,balance,checkin_streak,avatar,cover,created_at)
  VALUES (@username,@nickname,@pw,@bio,@location,@verified,@vip,'user',@exp,@points,0,@streak,@avatar,@cover,@created)`);
const insPost = db.prepare(`INSERT INTO posts
  (user_id,content,media,media_type,visibility,price,location,device,topic_id,views,like_count,comment_count,share_count,created_at)
  VALUES (@user,@content,@media,@mtype,@vis,@price,@loc,@device,@topic,@views,@likes,0,@shares,@created)`);
const insFollow = db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?,?,?)');

let nU = 0, nP = 0, nF = 0;

const makeNick = () => (pick(NICK_A) + pick(NICK_B) + pick(NICK_C)).slice(0, 14) || pick(NICK_B) + pick(NICK_C);

const tx = db.transaction(() => {
  // users
  for (let k = 0; k < needUsers; k++) {
    const idx = haveUsers + k;
    const username = `hsns_${idx}`;
    const r = insUser.run({
      username, nickname: makeNick(), pw,
      bio: pick(BIOS), location: pick(CITY),
      verified: Math.random() < 0.04 ? 1 : 0, vip: Math.random() < 0.12 ? 1 : 0,
      exp: rnd(0, 9000), points: rnd(50, 4000), streak: rnd(0, 60),
      avatar: `https://i.pravatar.cc/240?img=${pick(PRAV)}`,
      cover: img(`cover-${username}`),
      created: daysAgo(rnd(1, 200), rnd(0, 23)),
    });
    if (r.changes) nU++;
  }

  // collect all user ids for post assignment + follows
  const userIds = db.prepare('SELECT id FROM users').all().map((u) => u.id);

  // posts
  for (let k = 0; k < needPosts; k++) {
    const cat = pick(CATS);
    let content = pick(cat.s) + pick(TAILS);
    const useTopic = cat.t && topicIds[cat.t] && Math.random() < 0.6;
    if (useTopic) content = `#${cat.t}# ${content}`;
    const roll = Math.random();
    let media = [], mtype = 'text';
    if (roll < 0.30) { const n = rnd(1, roll < 0.12 ? 4 : 1); media = Array.from({ length: n }, (_, i) => ({ type: 'image', url: img(`b${k}-${i}`) })); mtype = 'image'; }
    else if (roll < 0.33) { media = [{ type: 'video', url: pick(VIDEO) }]; mtype = 'video'; }
    const vis = Math.random() < 0.04 ? 'paid' : 'public';
    insPost.run({
      user: pick(userIds), content,
      media: JSON.stringify(media), mtype, vis, price: vis === 'paid' ? pick([20, 50, 99]) : 0,
      loc: Math.random() < 0.5 ? pick(CITY) : '',
      device: Math.random() > 0.5 ? '手机端' : '电脑端',
      topic: useTopic ? topicIds[cat.t] : null,
      views: rnd(20, 5000), likes: rnd(0, 400), shares: rnd(0, 30),
      created: daysAgo(rnd(0, 200), rnd(0, 23)),
    });
    if (useTopic) db.prepare('UPDATE topics SET post_count = post_count + 1 WHERE id=?').run(topicIds[cat.t]);
    nP++;
  }

  // light social graph: each NEW user follows a few random users
  if (needUsers > 0) {
    const newUsers = db.prepare("SELECT id FROM users WHERE username LIKE 'hsns_%'").all().map((u) => u.id);
    const allIds = db.prepare('SELECT id FROM users').all().map((u) => u.id);
    for (const uid of newUsers) {
      const n = rnd(2, 7);
      for (let j = 0; j < n; j++) {
        const target = pick(allIds);
        if (target !== uid && insFollow.run(uid, target, daysAgo(rnd(0, 120))).changes) nF++;
      }
    }
  }
});
tx();

console.log(`seed-bulk: +${nU} users, +${nP} posts, +${nF} follows | totals → users ${haveUsers + nU}, posts ${havePosts + nP}`);
