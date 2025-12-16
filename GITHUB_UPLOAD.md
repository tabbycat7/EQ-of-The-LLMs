# GitHub 上传指南

## 步骤 1: 初始化 Git 仓库

在项目根目录下执行：

```bash
git init
```

## 步骤 2: 添加所有文件

```bash
git add .
```

## 步骤 3: 提交更改

```bash
git commit -m "Initial commit: LMArena AI模型对战评测平台"
```

## 步骤 4: 在 GitHub 上创建新仓库

1. 登录 GitHub
2. 点击右上角的 "+" 按钮，选择 "New repository"
3. 填写仓库名称（例如：`LLMEQ` 或 `LMArena`）
4. 选择 Public 或 Private
5. **不要**勾选 "Initialize this repository with a README"（因为我们已经有了）
6. 点击 "Create repository"

## 步骤 5: 连接本地仓库到 GitHub

GitHub 会显示仓库地址，执行以下命令（将 `YOUR_USERNAME` 和 `YOUR_REPO_NAME` 替换为你的实际信息）：

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

或者使用 SSH（如果你配置了 SSH key）：

```bash
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
```

## 步骤 6: 推送代码到 GitHub

```bash
git branch -M main
git push -u origin main
```

## 注意事项

### ✅ 已自动忽略的文件（不会上传）

- `.env` - 环境变量文件（包含 API 密钥）
- `*.db` - 数据库文件
- `__pycache__/` - Python 缓存文件
- `.vscode/`, `.idea/` - IDE 配置文件

### ⚠️ 重要提醒

1. **不要上传 `.env` 文件**：确保 `.env` 在 `.gitignore` 中（已包含）
2. **不要上传数据库文件**：`lmarena.db` 等数据库文件已被忽略
3. **README.md 已更新**：包含了最新的功能说明

### 📝 后续更新代码

如果之后修改了代码，使用以下命令更新 GitHub：

```bash
git add .
git commit -m "描述你的更改"
git push
```

## 可选：添加 LICENSE

如果你想添加许可证，可以：

1. 在 GitHub 仓库页面点击 "Add file" > "Create new file"
2. 文件名输入 `LICENSE`
3. 选择许可证模板（推荐 MIT License）
4. 提交

## 可选：添加 GitHub Actions（CI/CD）

如果需要自动化测试或部署，可以创建 `.github/workflows/` 目录。

---

**完成！** 现在你的项目已经上传到 GitHub 了！🎉

