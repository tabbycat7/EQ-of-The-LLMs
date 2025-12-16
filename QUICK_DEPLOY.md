# 快速部署指南 - Render（推荐）

这是最简单的部署方式，适合快速上线。

## 🚀 5 分钟快速部署

### 步骤 1: 准备 GitHub 仓库

确保代码已推送到 GitHub：
```bash
git add .
git commit -m "准备部署"
git push
```

### 步骤 2: 在 Render 创建服务

1. **访问**: https://render.com
2. **登录**: 使用 GitHub 账户
3. **创建 Web Service**:
   - 点击 "New +" > "Web Service"
   - 连接你的 GitHub 仓库
   - 点击 "Connect"

### 步骤 3: 配置服务

**基本信息：**
- Name: `lmarena` (或任意名称)
- Region: `Singapore` (或离你最近的)

**构建设置：**
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 步骤 4: 配置环境变量

在 "Environment Variables" 部分添加：

```
OPENAI_API_KEY=sk-你的密钥
OPENAI_BASE_URL=https://api.openai.com/v1
DEEPSEEK_API_KEY=你的密钥（可选）
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DATABASE_URL=sqlite+aiosqlite:///./lmarena.db
```

**注意**: 如果使用 SQLite，数据会在重启后丢失。建议使用外部 MySQL。

### 步骤 5: 创建数据库（可选）

如果需要持久化数据：

1. 在 Render 创建 **PostgreSQL** 数据库
2. 修改 `DATABASE_URL` 为 PostgreSQL 连接字符串
3. 需要修改代码以支持 PostgreSQL（见下方）

### 步骤 6: 部署

点击 "Create Web Service"，等待 5-10 分钟部署完成。

### 步骤 7: 访问

部署完成后，你会得到一个 URL，例如：
```
https://lmarena.onrender.com
```

---

## 📝 使用外部 MySQL（推荐）

### 选项 1: PlanetScale（免费）

1. 访问 https://planetscale.com
2. 注册并创建数据库
3. 获取连接字符串
4. 格式：`mysql+asyncmy://用户名:密码@主机:3306/数据库名`

### 选项 2: Aiven（免费试用）

1. 访问 https://aiven.io
2. 创建 MySQL 服务
3. 获取连接字符串

---

## ⚠️ 重要提示

### Render 免费套餐限制

- **休眠**: 15 分钟无活动后会自动休眠
- **首次访问**: 休眠后首次访问需要 30-60 秒唤醒
- **解决方案**: 
  - 使用付费套餐（$7/月）
  - 或使用外部监控服务定期 ping 你的 URL

### 数据库选择

- **SQLite**: 简单但数据不持久（重启丢失）
- **MySQL**: 需要外部服务，数据持久
- **PostgreSQL**: 需要修改代码（见下方）

---

## 🔧 如果需要使用 PostgreSQL

如果平台只提供 PostgreSQL，需要修改：

### 1. 修改 `requirements.txt`

将：
```
asyncmy==0.2.9
```

改为：
```
asyncpg==0.29.0
```

### 2. 修改 `models/database.py`

将：
```python
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./lmarena.db")
```

改为：
```python
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@host:5432/dbname")
```

### 3. 修改连接字符串格式

`DATABASE_URL` 格式：
```
postgresql+asyncpg://用户名:密码@主机:5432/数据库名
```

---

## ✅ 部署检查清单

- [ ] 代码已推送到 GitHub
- [ ] 在 Render 创建了 Web Service
- [ ] 配置了环境变量（API keys）
- [ ] 设置了 Build Command 和 Start Command
- [ ] 部署成功，可以访问 URL
- [ ] 测试了基本功能

---

## 🐛 常见问题

### 部署失败

1. **检查日志**: Render Dashboard > Logs
2. **常见原因**:
   - 依赖安装失败 → 检查 `requirements.txt`
   - 端口错误 → 确保使用 `$PORT`
   - 数据库连接失败 → 检查 `DATABASE_URL`

### 应用无法访问

1. **检查服务状态**: 确保显示 "Live"
2. **检查 URL**: 确保使用 HTTPS
3. **检查日志**: 查看错误信息

### 数据库连接错误

1. **检查连接字符串格式**
2. **确保数据库允许外部连接**
3. **检查防火墙设置**

---

## 🎉 完成！

部署成功后，分享你的 URL 给其他人使用吧！

**示例 URL**: `https://lmarena.onrender.com`

---

## 📚 更多选项

如果 Render 不适合，查看 `DEPLOYMENT.md` 了解其他平台：
- Railway
- Fly.io
- Heroku

