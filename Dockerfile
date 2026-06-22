# HahaSNS 生产镜像:单 Express 进程,服务 client/dist + /api + /uploads(:4000)
# 多阶段:构建前端 → 安装服务端(含 better-sqlite3 原生编译)→ 精简运行时
# npm 镜像源：默认官方；大陆构建可传 --build-arg NPM_REGISTRY=https://registry.npmmirror.com 加速
ARG NPM_REGISTRY=https://registry.npmjs.org

# ---- 1) 构建前端 ----
FROM node:20-bookworm AS client
ARG NPM_REGISTRY
WORKDIR /app/client
COPY client/package*.json ./
RUN npm config set registry "$NPM_REGISTRY" && npm install
COPY client/ ./
RUN npm run build

# ---- 2) 服务端依赖(原生编译 better-sqlite3)----
FROM node:20-bookworm-slim AS server
ARG NPM_REGISTRY
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm config set registry "$NPM_REGISTRY" && npm install --omit=dev
COPY server/ ./

# ---- 3) 运行时 ----
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=server /app/server /app/server
COPY --from=client /app/client/dist /app/client/dist
EXPOSE 4000
WORKDIR /app/server
CMD ["node", "src/index.js"]
