"""配置文件"""
import os
from dotenv import load_dotenv

load_dotenv()

# OpenAI API 配置
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

# 数据库配置
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./lmarena.db")

# 支持的模型列表
AVAILABLE_MODELS = [
    {
        "id": "gpt-4-turbo-preview",
        "name": "GPT-4 Turbo",
        "provider": "openai",
        "initial_rating": 1500
    },
    {
        "id": "gpt-4",
        "name": "GPT-4",
        "provider": "openai",
        "initial_rating": 1500
    },
    {
        "id": "gpt-3.5-turbo",
        "name": "GPT-3.5 Turbo",
        "provider": "openai",
        "initial_rating": 1400
    },
    {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "provider": "openai",
        "initial_rating": 1500
    },
    {
        "id": "gpt-4o-mini",
        "name": "GPT-4o Mini",
        "provider": "openai",
        "initial_rating": 1450
    },
]

# ELO 评分系统参数
ELO_K_FACTOR = 32  # ELO K 因子，控制评分变化幅度
INITIAL_RATING = 1500  # 初始 ELO 评分

