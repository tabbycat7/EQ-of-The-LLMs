"""API 路由"""
from .battle import router as battle_router
from .chat import router as chat_router
from .leaderboard import router as leaderboard_router

__all__ = ["battle_router", "chat_router", "leaderboard_router"]

