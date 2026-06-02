# PlanShare 单进程生产镜像（Fastify 同源托管 dist + /api + SQLite）
FROM node:22-slim
WORKDIR /app

# better-sqlite3 是原生模块；slim 镜像缺编译链时需要这几样（有预编译则用不上，留着稳妥）
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 上线务必用环境变量设置 ADMIN_PASSWORD；HOST=0.0.0.0 让容器外可达。
# 未设置 ADMIN_PASSWORD 或仍用默认值时，公网绑定会拒绝启动。
ENV PORT=8080 HOST=0.0.0.0
EXPOSE 8080

# 数据库文件 server/planshare.db 需挂持久卷，否则重启丢数据：
#   docker run -e ADMIN_PASSWORD=你的密码 -p 8080:8080 -v planshare-data:/app/server planshare
CMD ["node", "server/index.mjs"]
