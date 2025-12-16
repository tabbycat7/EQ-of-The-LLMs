# LMArena - AI 模型对战评测平台

一个类似 lmarena.ai 的 AI 模型体验与评测平台，支持匿名对战、并排对比和公开排行榜。

## 功能特性

### 1. 匿名对战模式 (Battle Mode)
- 系统随机选择两个匿名模型同时回答用户问题
- 用户投票选择更好的答案
- 投票后揭示模型身份
- 所有投票数据累计到公开排行榜

### 2. 并排对比模式 (Side-by-Side)
- 用户选择两个模型进行对比
- 实时查看两个模型的回答
- 支持投票，数据计入排行榜

### 3. 排行榜系统
- 基于匿名对战和并排对比的投票数据
- 使用 ELO 评分系统
- 实时更新模型排名

## 技术栈

- **后端框架**: FastAPI
- **数据库**: MySQL / SQLite + SQLAlchemy
- **AI 接口**: OpenAI Python SDK（支持 OpenAI 兼容 API 和 DeepSeek API）
- **前端**: HTML + Vanilla JavaScript + CSS

## 安装与运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

创建 `.env` 文件并填入你的配置：

```bash
# OpenAI API 配置（或兼容的 API）
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1

# DeepSeek API 配置（可选）
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# 数据库配置
DATABASE_URL=mysql+asyncmy://user:password@localhost:3306/lmarena
# 或使用 SQLite
# DATABASE_URL=sqlite+aiosqlite:///./lmarena.db
```

### 3. 运行服务器

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问应用

打开浏览器访问: http://localhost:8000

## 项目结构

```
LLMEQ/
├── main.py                 # FastAPI 应用主入口
├── models/                 # 数据库模型
│   ├── __init__.py
│   └── database.py
├── services/              # 业务逻辑层
│   ├── __init__.py
│   ├── model_service.py   # 模型调用服务
│   └── rating_service.py  # ELO 评分服务
├── api/                   # API 路由
│   ├── __init__.py
│   ├── battle.py          # 对战相关 API
│   ├── chat.py            # 对话相关 API
│   └── leaderboard.py     # 排行榜 API
├── static/                # 静态文件
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
├── templates/             # HTML 模板
│   └── index.html
├── config.py             # 配置文件
├── requirements.txt      # Python 依赖
└── README.md            # 项目文档
```

## API 文档

启动服务器后，访问 http://localhost:8000/docs 查看完整的 API 文档。

### 主要 API 端点

- `POST /api/battle/start` - 开始匿名对战
- `POST /api/battle/chat` - 发送消息到对战模型
- `POST /api/battle/vote` - 提交投票
- `GET /api/battle/reveal/{session_id}` - 揭示模型身份
- `POST /api/chat/sidebyside` - 并排对比模式
- `POST /api/chat/sidebyside/vote` - 并排对比投票
- `GET /api/leaderboard` - 获取排行榜

## 支持的模型

支持通过 OpenAI 兼容 API 调用的模型，包括：
- OpenAI 系列模型（GPT-4o, GPT-5, O1, O3 等）
- Claude 系列模型（通过兼容 API）
- Gemini 系列模型（通过兼容 API）
- DeepSeek 模型（deepseek-chat, deepseek-reasoner）

可通过修改 `config.py` 中的 `AVAILABLE_MODELS` 列表来添加或移除模型。

## 许可证

MIT License

