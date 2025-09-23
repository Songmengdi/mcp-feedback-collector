# 使用 Node.js 21 基础镜像
FROM node:21-alpine

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV MCP_TRANSPORT_MODE=mcp
ENV LOG_LEVEL=info

# 复制根目录的 package.json 和 package-lock.json
COPY package*.json ./

# 安装根目录依赖
RUN npm ci --only=production

# 复制前端目录的 package.json
COPY frontend/package*.json ./frontend/

# 安装前端依赖
RUN cd frontend && npm ci

# 复制前端源码
COPY frontend/ ./frontend/

# 构建前端
RUN cd frontend && npm run build

# 复制后端源码
COPY src/ ./src/
COPY tsconfig.json ./

# 安装开发依赖用于编译
RUN npm install --only=dev

# 编译 TypeScript
RUN npm run build:backend

# 清理开发依赖
RUN npm prune --production

# 复制其他必要文件
COPY LICENSE ./
COPY README.md ./

# 创建数据目录
RUN mkdir -p /app/logs /app/data

# 暴露端口
EXPOSE 3001 10050

# 设置用户权限
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs

# 启动命令 - 使用 MCP 模式
CMD ["npm", "run", "start", "--", "--mode", "mcp", "--persistent"]
