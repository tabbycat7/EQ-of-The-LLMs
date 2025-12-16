# GitHub 认证问题解决方案

## 问题描述

```
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/tabbycat7/EQ-of-The-LLMs.git/'
```

GitHub 从 2021 年 8 月起不再支持密码认证，需要使用 **Personal Access Token (PAT)** 或 **SSH 密钥**。

---

## 🔑 解决方案 1: 使用 Personal Access Token (推荐)

### 步骤 1: 创建 Personal Access Token

1. 登录 GitHub
2. 点击右上角头像 > **Settings**
3. 左侧菜单最下方，点击 **Developer settings**
4. 点击 **Personal access tokens** > **Tokens (classic)**
5. 点击 **Generate new token** > **Generate new token (classic)**
6. 填写信息：
   - **Note**: `LMArena Project` (任意描述)
   - **Expiration**: 选择过期时间（建议 90 天或 No expiration）
   - **Select scopes**: 勾选 `repo` (完整仓库访问权限)
7. 点击 **Generate token**
8. **重要**: 复制生成的 token（只显示一次！）

### 步骤 2: 使用 Token 推送代码

#### Windows (PowerShell/CMD)

```bash
# 方法 1: 在 URL 中使用 token
git remote set-url origin https://YOUR_TOKEN@github.com/tabbycat7/EQ-of-The-LLMs.git

# 然后正常推送
git push
```

#### 或者使用 Git Credential Manager

```bash
# 推送时，用户名输入你的 GitHub 用户名
# 密码输入刚才复制的 token
git push
```

#### Linux/Mac

```bash
# 方法 1: 在 URL 中使用 token
git remote set-url origin https://YOUR_TOKEN@github.com/tabbycat7/EQ-of-The-LLMs.git

# 然后正常推送
git push
```

### 步骤 3: 保存凭据（可选）

#### Windows

Git Credential Manager 会自动保存，下次不需要再输入。

#### Linux/Mac

```bash
# 使用 Git Credential Helper
git config --global credential.helper store

# 下次推送时输入一次，之后会自动保存
git push
```

---

## 🔐 解决方案 2: 使用 SSH 密钥（更安全）

### 步骤 1: 检查是否已有 SSH 密钥

```bash
ls -al ~/.ssh
```

如果看到 `id_rsa` 和 `id_rsa.pub`，说明已有密钥，跳到步骤 3。

### 步骤 2: 生成 SSH 密钥

```bash
# Windows (Git Bash 或 PowerShell)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Linux/Mac
ssh-keygen -t ed25519 -C "your_email@example.com"
```

按提示操作：
- 保存位置：直接回车（使用默认位置）
- 密码：可以设置密码或直接回车（不设置）

### 步骤 3: 复制公钥

#### Windows (PowerShell)

```powershell
cat ~/.ssh/id_ed25519.pub
```

#### Linux/Mac

```bash
cat ~/.ssh/id_ed25519.pub
```

复制输出的内容（以 `ssh-ed25519` 开头）。

### 步骤 4: 添加到 GitHub

1. 登录 GitHub
2. 点击右上角头像 > **Settings**
3. 左侧菜单点击 **SSH and GPG keys**
4. 点击 **New SSH key**
5. 填写：
   - **Title**: `My Computer` (任意名称)
   - **Key**: 粘贴刚才复制的公钥
6. 点击 **Add SSH key**

### 步骤 5: 测试 SSH 连接

```bash
ssh -T git@github.com
```

如果看到 "Hi tabbycat7! You've successfully authenticated..." 说明成功。

### 步骤 6: 更改远程仓库 URL

```bash
# 将 HTTPS URL 改为 SSH URL
git remote set-url origin git@github.com:tabbycat7/EQ-of-The-LLMs.git

# 验证
git remote -v

# 推送
git push
```

---

## 🔄 解决方案 3: 使用 GitHub CLI (最简单)

### 步骤 1: 安装 GitHub CLI

#### Windows

```powershell
# 使用 Chocolatey
choco install gh

# 或使用 Scoop
scoop install gh
```

#### Mac

```bash
brew install gh
```

#### Linux

```bash
# Ubuntu/Debian
sudo apt install gh

# Fedora
sudo dnf install gh
```

### 步骤 2: 登录 GitHub

```bash
gh auth login
```

按提示选择：
- **GitHub.com**
- **HTTPS** 或 **SSH**
- **Login with a web browser** (推荐)

### 步骤 3: 推送代码

```bash
git push
```

GitHub CLI 会自动处理认证。

---

## ✅ 验证配置

### 检查远程仓库 URL

```bash
git remote -v
```

应该显示：
- HTTPS: `https://github.com/tabbycat7/EQ-of-The-LLMs.git`
- SSH: `git@github.com:tabbycat7/EQ-of-The-LLMs.git`

### 测试推送

```bash
git push
```

如果成功，说明认证配置正确。

---

## 🐛 常见问题

### 问题 1: Token 无效

- 检查 token 是否过期
- 确认 token 有 `repo` 权限
- 重新生成 token

### 问题 2: SSH 连接失败

```bash
# 测试连接
ssh -T git@github.com

# 如果失败，检查 SSH 代理
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### 问题 3: 凭据缓存问题

#### Windows

```bash
# 清除凭据管理器中的 GitHub 凭据
# 控制面板 > 凭据管理器 > Windows 凭据 > 删除 GitHub 相关条目
```

#### Linux/Mac

```bash
# 清除 Git 凭据缓存
git credential-cache exit
```

---

## 📝 推荐方案

- **新手**: 使用 **Personal Access Token** (方案 1)
- **长期使用**: 使用 **SSH 密钥** (方案 2)
- **最方便**: 使用 **GitHub CLI** (方案 3)

---

## 🎉 完成！

配置完成后，你就可以正常推送代码到 GitHub 了！

```bash
git add .
git commit -m "你的提交信息"
git push
```

