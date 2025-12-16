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

# 支持的模型列表
AVAILABLE_MODELS = [
    {
        "id": "gemini-2.5-pro-thinking",
        "name": "Gemini 2.5 Pro Thinking",
        "provider": "google",
        "initial_rating": 0
    },
    {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "gpt-5",
        "name": "GPT-5",
        "provider": "openai",
        "initial_rating": 0
    },
    {
        "id": "gpt-4o-mini",
        "name": "GPT-4o Mini",
        "provider": "openai",
        "initial_rating": 0
    },
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

# ELO 评分系统参数
ELO_K_FACTOR = 32  # ELO K 因子，控制评分变化幅度
INITIAL_RATING = 1500  # 初始 ELO 评分

