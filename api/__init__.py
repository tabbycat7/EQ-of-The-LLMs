"""API 路由"""
from .battle import router as battle_router
from .chat import router as chat_router
from .leaderboard import router as leaderboard_router
from .user import router as user_router
from .philosophy import router as philosophy_router

__all__ = ["battle_router", "chat_router", "leaderboard_router", "user_router", "philosophy_router"]

