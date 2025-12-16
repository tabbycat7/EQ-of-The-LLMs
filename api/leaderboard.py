"""Leaderboard 排行榜 API"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Dict

from models.database import get_db
from services.rating_service import RatingService

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


class LeaderboardResponse(BaseModel):
    """排行榜响应"""
    leaderboard: List[Dict]
    total_models: int


@router.get("", response_model=LeaderboardResponse)
async def get_leaderboard(
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """
    获取模型排行榜
    基于积分制评分排序
    """
    leaderboard = await RatingService.get_leaderboard(db, limit=limit)
    
    return LeaderboardResponse(
        leaderboard=leaderboard,
        total_models=len(leaderboard)
    )

