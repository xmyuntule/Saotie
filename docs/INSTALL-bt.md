# 宝塔面板部署教程（BT Panel / aaPanel）

HahaSNS 的后端是**单个 Node 进程**，它同时伺服前端页面（`client/dist`）、`/api` 接口和 `/uploads` 上传文件——**全部在同一个端口上**。所以在宝塔里部署非常简单：用「**Node 项目**」托管这一个进程，再把域名绑过去即可，**不需要**单独建静态站点、也**不需要**手写 Nginx 反向代理 / `try_files`。

> 数据库默认用 **SQLite（零配置**，就是 `server/data/` 下的一个文件，不用在宝塔里建库）。需要 MySQL/Redis 的生产版见文末「进阶」。

整套你要做的，本质只有三件事：**① 跑一次安装脚本 → ② 建 Node 项目并填环境变量 → ③ 绑域名**。

> **🌏 大陆 / 国外**
> - **大陆服务器**：第二步装依赖前先用 npm 国内镜像，把命令改成
>   `NPM_REGISTRY=https://registry.npmmirror.com bash scripts/setup.sh`（脚本会自动用该镜像），否则装依赖慢/易失败。（字体已随站自托管，无需 Google，大陆访问无障碍。）
> - **国外服务器**：直接 `bash scripts/setup.sh`，无需改动。

> 也可用 Docker 部署（见 [1Panel 教程](INSTALL-1panel.md)）；本文用宝塔原生 Node 项目，无需 Docker。

---

## 一、准备（宝塔软件商店）

- 安装 **Node.js 版本管理器**，装一个 **Node 20 LTS** 并设为默认。
- 备一个解析到服务器的**域名**（可选；没有就先用 IP）。
- 无需安装 MySQL/PHP；Nginx 宝塔通常已自带（绑域名时用得到，不用手配）。

> 若安装依赖时 `better-sqlite3` 报编译错误，在 SSH 里补装构建工具：
> Ubuntu/Debian `apt install -y build-essential python3`；CentOS `yum install -y gcc-c++ make python3`。

---

## 二、拉取代码 + 一键安装

在宝塔「文件」把代码放到例如 `/www/wwwroot/hahasns`（或终端 `git clone`），然后在「终端」执行：

```bash
cd /www/wwwroot/hahasns
bash scripts/setup.sh        # 构建前端 + 安装后端依赖，一条命令搞定
```

完成后会得到 `client/dist`（前端产物）和 `server/node_modules`（后端依赖）。

---

## 三、建 Node 项目（托管后端 = 整个站点）

宝塔「**网站 → Node 项目 → 添加 Node 项目**」：

| 项 | 填写 |
| --- | --- |
| 项目目录 | `/www/wwwroot/hahasns/server` |
| 启动方式 | `node src/index.js`（或 `npm start`） |
| Node 版本 | 20 |
| 端口 | `4000` |
| 开机自启 / 守护 | 打开 |

**环境变量**（在 Node 项目的「环境变量」里逐条加，这是你唯一需要配置的地方）：

| 变量 | 说明 |
| --- | --- |
| `JWT_SECRET` | **必改**，登录令牌密钥，填一段强随机串（见下方生成命令） |
| `PORT` | `4000`（与上面端口一致） |
| `NODE_ENV` | `production` |
| `SEED_PASSWORD` | 可选，演示账号统一密码 |
| `ANTHROPIC_API_KEY` | 可选，配了才启用 AI 助手 |

> 生成 JWT 密钥：`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

保存并启动，验证：`curl http://127.0.0.1:4000/api/health` 应返回 `{"ok":true,"app":"HahaSNS"}`。

（可选）填充演示数据：`cd /www/wwwroot/hahasns/server && npm run seed`（**会清空并重置**演示内容，已有真实数据请勿执行）。

---

## 四、绑定域名（宝塔自动反代，无需手写 Nginx）

在刚建的 **Node 项目**里找到「**域名 / 映射**」（不同宝塔版本叫法略不同），添加你的域名——宝塔会**自动**把该域名反向代理到项目的 `4000` 端口。然后：

- **HTTPS**：到该站点「设置 → SSL」申请 Let's Encrypt 免费证书并开启「强制 HTTPS」。
- **大文件上传**：在站点「设置 → 配置文件」把 `client_max_body_size` 调到 `30m`（应用端单文件上限约 25 MB）。

浏览器打开域名即可访问，首页 / 登录 / 发帖都正常就说明部署完成。

> 没有域名时：直接用 `http://服务器IP:4000` 访问（需在面板安全 + 云安全组放行 4000）；正式上线建议走域名 + HTTPS（登录令牌需要 HTTPS 保护）。

---

## 五、更新与维护

```bash
cd /www/wwwroot/hahasns
git pull                 # 或重新上传代码
bash scripts/setup.sh    # 重新构建前端 + 匹配后端原生模块
# 然后在「Node 项目」里点重启
```

- **数据持久化**：SQLite 库在 `server/data/`、上传在 `server/uploads/`，更新时**切勿覆盖这两个目录**。
- 后端自启：Node 项目打开「守护 / 开机自启」即可。

---

## 六、常见问题

| 现象 | 排查 |
| --- | --- |
| 打开 404 / 白屏 | 是否执行过 `bash scripts/setup.sh`（生成了 `client/dist`）？Node 项目是否在运行？ |
| 接口 502 | `curl 127.0.0.1:4000/api/health` 是否通？端口、域名映射是否对上 4000？ |
| 上传失败 | 站点 `client_max_body_size` 是否 ≥ 30m？ |
| `better-sqlite3` 编译报错 | 是否装了 `build-essential`/`gcc-c++ make` + `python3`？换 Node 版本后重跑 `setup.sh`。 |

---

## 进阶：MySQL / Redis / S3 生产版

仓库里的 `server-nest/`（NestJS + TypeORM + MySQL + Redis + S3）是面向更大规模的生产后端。用宝塔部署它时，额外在宝塔装 **MySQL** 与 **Redis**，建好库后把连接信息填进 `server-nest` 的环境变量（数据库、Redis、域名等），启动 `server-nest/dist/main.js`，其余（Node 项目托管、绑域名）与上文一致。详见 `server-nest/README.md`。
