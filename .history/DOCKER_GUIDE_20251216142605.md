# Docker 部署指南

本指南将帮助你使用 Docker 容器化部署 LMArena。

## 📋 前置要求

- 安装 Docker: https://docs.docker.com/get-docker/
- 安装 Docker Compose: https://docs.docker.com/compose/install/

## 🚀 快速开始

### 方法 1: 使用 Docker Compose（推荐）

#### 步骤 1: 创建 `.env` 文件

在项目根目录创建 `.env` 文件：

```bash
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DATABASE_URL=sqlite+aiosqlite:///./lmarena.db
```

#### 步骤 2: 构建并启动

```bash
docker-compose up -d
```

#### 步骤 3: 访问应用

打开浏览器访问: http://localhost:8000

#### 步骤 4: 查看日志

```bash
docker-compose logs -f
```

#### 步骤 5: 停止服务

```bash
docker-compose down
```

---

### 方法 2: 使用 Docker 命令

#### 步骤 1: 构建镜像

```bash
docker build -t lmarena .
```

#### 步骤 2: 运行容器

```bash
docker run -d \
  --name lmarena \
  -p 8000:8000 \
  -e OPENAI_API_KEY=your_key \
  -e OPENAI_BASE_URL=https://api.openai.com/v1 \
  -e DATABASE_URL=sqlite+aiosqlite:///./lmarena.db \
  lmarena
```

#### 步骤 3: 访问应用

打开浏览器访问: http://localhost:8000

#### 步骤 4: 查看日志

```bash
docker logs -f lmarena
```

#### 步骤 5: 停止容器

```bash
docker stop lmarena
docker rm lmarena
```

---

## 🗄️ 使用 MySQL 数据库

### 选项 1: 使用 Docker Compose 中的 MySQL

编辑 `docker-compose.yml`，取消注释 MySQL 服务部分：

```yaml
mysql:
  image: mysql:8.0
  container_name: lmarena-mysql
  environment:
    - MYSQL_ROOT_PASSWORD=rootpassword
    - MYSQL_DATABASE=lmarena
    - MYSQL_USER=lmarena
    - MYSQL_PASSWORD=lmarenapassword
  volumes:
    - mysql_data:/var/lib/mysql
  ports:
    - "3306:3306"
```

更新 `.env` 文件：

```bash
DATABASE_URL=mysql+asyncmy://lmarena:lmarenapassword@mysql:3306/lmarena
```

启动服务：

```bash
docker-compose up -d
```

### 选项 2: 使用外部 MySQL

在 `.env` 中设置外部 MySQL 连接：

```bash
DATABASE_URL=mysql+asyncmy://user:password@host:3306/dbname
```

---

## 🔧 Docker 命令参考

### 构建镜像

```bash
# 基本构建
docker build -t lmarena .

# 指定标签
docker build -t lmarena:latest .

# 不使用缓存
docker build --no-cache -t lmarena .
```

### 运行容器

```bash
# 后台运行
docker run -d -p 8000:8000 --name lmarena lmarena

# 前台运行（查看日志）
docker run -p 8000:8000 --name lmarena lmarena

# 使用环境变量文件
docker run -d -p 8000:8000 --env-file .env --name lmarena lmarena
```

### 管理容器

```bash
# 查看运行中的容器
docker ps

# 查看所有容器
docker ps -a

# 停止容器
docker stop lmarena

# 启动已停止的容器
docker start lmarena

# 重启容器
docker restart lmarena

# 删除容器
docker rm lmarena

# 查看日志
docker logs lmarena
docker logs -f lmarena  # 实时日志
```

### 管理镜像

```bash
# 查看镜像
docker images

# 删除镜像
docker rmi lmarena

# 清理未使用的镜像
docker image prune
```

---

## 🐳 部署到云平台

### Docker Hub

#### 步骤 1: 登录 Docker Hub

```bash
docker login
```

#### 步骤 2: 标记镜像

```bash
docker tag lmarena yourusername/lmarena:latest
```

#### 步骤 3: 推送镜像

```bash
docker push yourusername/lmarena:latest
```

#### 步骤 4: 在服务器上拉取并运行

```bash
docker pull yourusername/lmarena:latest
docker run -d -p 8000:8000 --env-file .env --name lmarena yourusername/lmarena:latest
```

### 使用 Docker 的平台

以下平台支持直接部署 Docker 镜像：

- **Railway**: 支持 Dockerfile
- **Fly.io**: 支持 Dockerfile
- **Google Cloud Run**: 支持容器
- **AWS ECS/Fargate**: 支持容器
- **Azure Container Instances**: 支持容器

---

## 🔍 调试

### 进入容器

```bash
docker exec -it lmarena bash
```

### 查看容器内部文件

```bash
docker exec -it lmarena ls -la
```

### 检查环境变量

```bash
docker exec lmarena env
```

### 查看容器资源使用

```bash
docker stats lmarena
```

---

## 📝 优化建议

### 1. 多阶段构建（减小镜像大小）

可以创建 `Dockerfile.optimized`：

```dockerfile
# 构建阶段
FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# 运行阶段
FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2. 使用 .dockerignore

已创建 `.dockerignore` 文件，排除不必要的文件，减小构建上下文。

### 3. 健康检查

Dockerfile 中已包含健康检查，可以监控容器状态。

---

## ⚠️ 常见问题

### 端口已被占用

```bash
# 查看端口占用
netstat -ano | findstr :8000  # Windows
lsof -i :8000  # Linux/Mac

# 使用其他端口
docker run -p 8080:8000 lmarena
```

### 容器无法启动

```bash
# 查看日志
docker logs lmarena

# 检查环境变量
docker exec lmarena env

# 进入容器调试
docker exec -it lmarena bash
```

### 数据库连接失败

- 检查 `DATABASE_URL` 格式
- 确保数据库服务已启动
- 检查网络连接（如果使用外部数据库）

### 静态文件无法加载

确保 `static/` 和 `templates/` 目录已正确复制到镜像中。

---

## 🎉 完成！

现在你的应用已经容器化了，可以在任何支持 Docker 的环境中运行！

---

## 📚 相关资源

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [FastAPI 部署文档](https://fastapi.tiangolo.com/deployment/)

