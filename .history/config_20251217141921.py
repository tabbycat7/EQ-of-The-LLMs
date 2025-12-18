"""配置文件"""
import os
from dotenv import load_dotenv

load_dotenv(override=True)

# OpenAI API 配置
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")

# 数据库配置
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./lmarena.db")

# 支持的模型列表（已根据 API 实际支持的模型更新）
AVAILABLE_MODELS = [
    # OpenAI 兼容模型（使用 zetatechs.com API）
    {
        "id": "openai/chatgpt-4o-latest",
        "name": "GPT-4o",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "openai/gpt-4o-mini",
        "name": "GPT-4o Mini",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "openai/gpt-5.2",
        "name": "GPT-5.2",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "openai/gpt-5-mini",
        "name": "GPT-5 Mini",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "anthropic/claude-opus-4.5",
        "name": "Claude Opus 4.5",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "anthropic/claude-haiku-4.5",
        "name": "Claude Haiku 4.5",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "anthropic/claude-sonnet-4.5",
        "name": "Claude Sonnet 4.5",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "google/gemini-3-pro-preview",
        "name": "Gemini 3 Pro Preview",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "gemini-2.5-pro-thinking",
        "name": "Gemini 2.5 Pro Thinking",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "openai/o1",
        "name": "OpenAI O1",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "openai/o3",
        "name": "OpenAI O3",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "grok-4-0709",
        "name": "Grok 4",
        "provider": "xAI",
        "initial_rating": 0
    },
    {
        "id":"qwen3-235b-a22b-thinking",
        "name":"Qwen3 235B A22B Thinking",
        "provider":"Qwen",
        "initial_rating":0
    },
    # DeepSeek 模型（使用官方 DeepSeek API）
    {
        "id": "deepseek-chat",
        "name": "DeepSeek Chat",
        "provider": "deepseek",
        "initial_rating": 0
    },
    {
        "id": "deepseek-reasoner",
        "name": "DeepSeek Reasoner",
        "provider": "deepseek",
        "initial_rating": 0
    }
]

# 评分系统参数（积分制）
# - 胜：+2
# - 平：+1
# - 负：+0
WIN_POINTS = 2
TIE_POINTS = 1
LOSS_POINTS = 0

# 初始分数
INITIAL_RATING = 0

