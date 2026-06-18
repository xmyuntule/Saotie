# 宝塔面板部署教程（BT Panel / aaPanel）

本教程手把手带你用**宝塔面板**（国内版 BT Panel，国际版 aaPanel 操作基本一致）把 HahaSNS 部署到一台 Linux 服务器上，全程图形化操作，按步骤照做即可上线。

本教程以**简版后端（Express + SQLite）+ 前端静态站点**这套最常见、最省事的组合为例。它的部署形态是：

- 一个 **Node 进程**跑后端 API，监听本机 `4000` 端口；
- 用宝塔「**网站**」托管前端构建产物 `client/dist` 的静态文件；
- 用 **Nginx 反向代理**把 `/api`、`/uploads` 转发到后端 `4000`，其余请求走静态文件。

> 生产版（NestJS + MySQL/Redis/S3）也能用宝塔部署，区别只是后端进程换成 `server-nest` 的 `dist/main.js`，并在宝塔里额外安装 MySQL / Redis。本教程聚焦简版。

---

## 〇、准备工作

- 一台 Linux 服务器（Ubuntu / Debian / CentOS 均可），最低 **1 核 1G**，推荐 **2 核 2G**。
- 服务器的 root（或 sudo）登录权限。
- （可选）一个已解析到服务器公网 IP 的域名，用于绑定与申请 HTTPS。

> 安全提示：请勿在任何文档或聊天中明文粘贴服务器密码 / SSH 密码 / 面板密码。下文涉及的密码请你自行在面板里安全设置与保管。

---

## 一、安装宝塔面板

SSH 登录服务器后，按官网对应系统的命令安装宝塔面板（以官方最新安装脚本为准）。安装完成后，终端会输出**面板地址、用户名、初始密码**，请妥善保存。

浏览器打开面板地址登录后，宝塔会提示安装运行环境套件。本教程**不需要** LNMP 的 PHP / MySQL（简版用 SQLite），只需要 **Nginx**，可在「软件商店」里：

1. 安装 **Nginx**（任意稳定版本）。
2. 安装 **Node.js 版本管理器**（软件商店搜索 “Node”，安装「Node.js 版本管理器」插件）。
3. （生产版才需要）安装 **MySQL** 与 **Redis**。

---

## 二、在面板放行端口

进入面板「**安全**」页，放行以下端口；同时**在云服务商控制台的安全组里也放行同样的端口**（两边都要放行才生效）：

- **80**（HTTP）
- **443**（HTTPS，配域名后用）
- 面板自身端口（安装时输出的端口，仅给自己用）

后端的 **4000** 端口**不要对公网放行**，它只需本机访问，由 Nginx 代理对外。

---

## 三、安装 Node.js 运行环境

进入面板「**软件商店 → Node.js 版本管理器**」（或「网站 → Node 项目」里的 Node 版本管理入口）：

1. 安装一个 **Node 18 或 20（推荐 20 LTS）** 版本。
2. 将其**设为命令行默认版本**，这样在终端里 `node -v` 能用到它。

如果后续安装 `better-sqlite3` 提示需要编译工具，请在 SSH 里补装构建依赖：

- Debian / Ubuntu：`apt-get install -y build-essential python3`
- CentOS：`yum install -y gcc-c++ make python3`

---

## 四、上传 / 拉取代码

把代码放到服务器某个目录，例如 `/www/wwwroot/hahasns`：

**方式 A —— 用 Git（推荐）。** 在面板「终端」或 SSH 里：

```bash
cd /www/wwwroot
git clone <你的仓库地址> hahasns
cd hahasns
```

**方式 B —— 上传压缩包。** 在面板「文件」里进入 `/www/wwwroot`，上传项目压缩包并解压，得到 `/www/wwwroot/hahasns`。

确认目录里有 `client/`、`server/`、`docs/` 等子目录。

---

## 五、安装依赖并构建前端

在面板「**终端**」里执行（注意用上一步设为默认的 Node 版本）：

```bash
# 构建前端 → 产出 client/dist
cd /www/wwwroot/hahasns/client
npm install
npm run build

# 安装后端依赖
cd /www/wwwroot/hahasns/server
npm install

# 可选：填充演示数据（会重置演示内容，勿用于已有真实数据的库）
# npm run seed
```

构建成功后，应能在 `/www/wwwroot/hahasns/client/dist` 下看到 `index.html` 与 `assets/` 等静态文件。

> 若 `better-sqlite3` 安装报错，多半是缺编译工具，按第三节末尾补装后重试 `npm install`。

---

## 六、用「Node 项目」或 PM2 守护后端（端口 4000）

后端要常驻运行并开机自启，二选一。

### 方式 A —— 宝塔「Node 项目」管理器（图形化，推荐）

进入面板「**网站 → Node 项目 → 添加 Node 项目**」，按如下填写：

- **项目目录**：`/www/wwwroot/hahasns/server`
- **启动文件 / 启动选项**：`src/index.js`（若需要选「运行命令」，填 `node src/index.js`，或 `npm start`）
- **Node 版本**：选第三节安装的 18 / 20
- **端口**：`4000`
- **环境变量**（关键，逐条添加）：
  - `PORT=4000`
  - `NODE_ENV=production`
  - `JWT_SECRET=<一段强随机字符串>` —— 务必改成你自己的强随机值
  - （可选）`SEED_PASSWORD=<演示账号密码>`

> 生成强随机密钥：在终端执行
> `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`，把输出填到 `JWT_SECRET`。

保存后启动项目，并打开「开机自启 / 守护」选项。验证后端是否正常：

```bash
curl http://127.0.0.1:4000/api/health     # 应返回 {"ok":true,"app":"HahaSNS"}
```

### 方式 B —— PM2（命令行）

```bash
npm install -g pm2

cd /www/wwwroot/hahasns/server
NODE_ENV=production PORT=4000 JWT_SECRET=<强随机密钥> \
  pm2 start src/index.js --name hahasns

pm2 save                 # 记住进程列表
pm2 startup              # 按提示执行输出的命令，实现开机自启
pm2 logs hahasns         # 查看日志
```

---

## 七、用「网站」托管前端静态文件 + Nginx 反向代理

### 1. 新建站点

进入面板「**网站 → 添加站点**」：

- **域名**：填你的域名（没有域名时可先填服务器公网 IP）。
- **根目录**：填 **`/www/wwwroot/hahasns/client/dist`**（直接指向前端构建产物）。
- 数据库选「不创建」，PHP 选「纯静态」。

### 2. 配置反向代理与 SPA 回退

打开刚建好站点的「**设置 → 配置文件**」，在 `server { ... }` 块里加入下面的规则：把 `/api`、`/uploads` 转发到后端 `4000`，其余请求走静态文件、找不到时回退到 `index.html`（单页应用必需）。

```nginx
    # API 转发到后端
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 上传文件转发到后端
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
    }

    # 其余请求走静态文件，找不到回退到 SPA 入口
    location / {
        try_files $uri $uri/ /index.html;
    }
```

> 注意：宝塔默认配置里可能已有一段 `location /` 规则，请用上面的 `try_files` 版本替换它，避免冲突（同一个 `location /` 只能保留一份）。

另外，上传媒体可能较大，建议在站点「设置 → 配置文件」里把请求体上限调大（应用端单文件上限约 25 MB）：

```nginx
    client_max_body_size 30m;
```

保存配置，宝塔会自动 `nginx -t` 校验并重载。若校验报错，按提示检查大括号是否配对、是否有重复的 `location /`。

### 3. 验证

浏览器访问你的域名（或服务器 IP），应能正常打开 HahaSNS 首页；登录、发动态、看论坛等功能正常，说明 `/api` 与 `/uploads` 转发也通了。

---

## 八、绑定域名与配置 HTTPS（SSL）

1. 在域名服务商把域名 **A 记录**解析到服务器公网 IP，等待解析生效。
2. 在宝塔站点「**设置 → SSL**」里：
   - 选「**Let's Encrypt**」，勾选域名，申请免费证书；
   - 申请成功后开启「**强制 HTTPS**」，让 HTTP 自动跳转 HTTPS（登录令牌走这条连接，务必启用 HTTPS）。
3. 确认第二节已放行 **443** 端口（面板安全 + 云安全组都要放行）。

宝塔会自动为证书配置定时续期，无需手动维护。

---

## 九、设置开机自启与日常维护

- **后端自启**：用「Node 项目」时打开守护 / 自启选项；用 PM2 时确保执行过 `pm2 save` 与 `pm2 startup`。
- **Nginx 自启**：宝塔安装的 Nginx 默认随面板服务自启，无需额外设置。
- **更新代码 / 重新部署**：
  ```bash
  cd /www/wwwroot/hahasns
  git pull                                  # 或重新上传代码（注意排除 server/data、server/uploads）
  cd client && npm install && npm run build # 重新构建前端
  cd ../server && npm install               # 重新匹配原生模块
  # 然后在「Node 项目」里重启，或：pm2 restart hahasns
  ```
- **数据持久化**：SQLite 库在 `server/data/`、上传媒体在 `server/uploads/`，重新部署时**务必不要覆盖这两个目录**。备份方法见 [INSTALL.md](INSTALL.md) 与 [DEPLOY.md](DEPLOY.md)。

---

## 十、常见问题排查

| 现象 | 排查方向 |
| --- | --- |
| 打开站点 404 / 白屏 | 站点根目录是否指向 `client/dist`？是否已 `npm run build`？`location /` 是否配了 `try_files ... /index.html`？ |
| 页面能开但接口全 502 / 报错 | 后端是否在 4000 端口运行（`curl 127.0.0.1:4000/api/health`）？`/api/` 反代是否配置正确？ |
| 上传图片 / 视频失败 | Nginx `client_max_body_size` 是否够大（≥30m）？`/uploads/` 反代是否生效？ |
| 公网打不开 | 80 / 443 是否在面板安全 **和** 云安全组里都放行？域名解析是否生效？ |
| `npm install` 报 `better-sqlite3` 编译错误 | 是否装了构建工具（`build-essential` / `gcc-c++ make` + `python3`）？升级 Node 后是否重装了依赖？ |
| 重启服务器后站点不见了 | 后端是否设置了开机自启（Node 项目守护 / `pm2 startup`）？ |
| 域名跳转异常 / 证书无效 | SSL 是否申请成功、是否开启强制 HTTPS、443 是否放行？ |

至此，HahaSNS 已通过宝塔面板成功部署并对外提供服务。
