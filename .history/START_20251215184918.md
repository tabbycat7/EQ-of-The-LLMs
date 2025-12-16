# 🚀 快速启动指南

## 第一步：安装依赖

```bash
pip install -r requirements.txt
```

## 第二步：配置 API 密钥

1. 复制环境变量示例文件：
```bash
copy .env.example .env
```

2. 编辑 `.env` 文件，填入你的 OpenAI API Key：
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

## 第三步：运行应用

```bash
python main.py
```

或者使用 uvicorn：
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 第四步：访问应用

打开浏览器访问: **http://localhost:8000**

## 📋 功能说明

### 1. 匿名对战模式 (Battle) ⚔️
- 点击"开始对战"按钮
- 输入你的问题，两个随机模型将匿名回答
- 查看两个回答后，投票选择更好的那个
- 投票后会揭示模型身份并更新排行榜

### 2. 并排对比模式 (Side-by-Side) 📊
- 选择两个你想对比的模型
- 输入问题，实时查看两个模型的回答差异
- 数据用于研究，不计入排行榜

### 3. 直接对话模式 (Direct Chat) 💬
- 选择一个模型
- 与该模型进行直接对话
- 体验特定模型的能力

### 4. 排行榜 (Leaderboard) 🏆
- 查看基于匿名对战投票的模型排名
- 使用 ELO 评分系统计算
- 实时更新

## 🔧 配置说明

### 添加更多模型

编辑 `config.py` 文件中的 `AVAILABLE_MODELS` 列表：

```python
AVAILABLE_MODELS = [
    {
        "id": "gpt-4-turbo-preview",
        "name": "GPT-4 Turbo",
        "provider": "openai",
        "initial_rating": 1500
    },
    # 添加更多模型...
]
```

### 使用其他 API 提供商

如果你使用的是兼容 OpenAI 格式的其他 API（如 Azure OpenAI、本地模型等），可以修改 `.env` 文件：

```
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://your-api-endpoint.com/v1
```

## 📊 API 文档

启动服务器后，访问以下地址查看完整 API 文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## ❓ 常见问题

### 1. 数据库在哪里？
数据库文件 `lmarena.db` 会自动在项目根目录创建。

### 2. 如何重置排行榜？
删除 `lmarena.db` 文件，重启应用即可重置。

### 3. API 调用失败怎么办？
- 检查 `.env` 文件中的 API Key 是否正确
- 检查网络连接
- 查看终端日志了解详细错误信息

### 4. 如何修改 ELO 评分参数？
编辑 `config.py` 文件中的 `ELO_K_FACTOR` 和 `INITIAL_RATING`。

## 🎯 项目特点

✅ 完整的匿名对战系统  
✅ ELO 评分算法  
✅ 实时排行榜  
✅ 多种对话模式  
✅ 现代化 UI 设计  
✅ 异步处理，高性能  
✅ RESTful API  
✅ 响应式设计，支持移动端  

## 📝 技术栈

- **后端**: FastAPI + SQLAlchemy + AsyncIO
- **数据库**: SQLite (可轻松迁移到 PostgreSQL/MySQL)
- **AI SDK**: OpenAI Python Library
- **前端**: Vanilla JavaScript + HTML5 + CSS3
- **评分系统**: ELO Rating Algorithm

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**祝你使用愉快！如有问题，请查看详细文档 README.md**

