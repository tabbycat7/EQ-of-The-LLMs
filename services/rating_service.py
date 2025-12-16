"""ELO 评分系统服务"""
import math
from typing import Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from models.schemas import ModelRating, Vote
import config


class RatingService:
    """ELO 评分系统服务"""
    
    @staticmethod
    def calculate_expected_score(rating_a: float, rating_b: float) -> Tuple[float, float]:
        """
        计算期望得分
        
        Args:
            rating_a: 模型 A 的当前评分
            rating_b: 模型 B 的当前评分
            
        Returns:
            (模型 A 的期望得分, 模型 B 的期望得分)
        """
        expected_a = 1 / (1 + math.pow(10, (rating_b - rating_a) / 400))
        expected_b = 1 / (1 + math.pow(10, (rating_a - rating_b) / 400))
        return expected_a, expected_b
    
    @staticmethod
    def calculate_new_ratings(
        rating_a: float,
        rating_b: float,
        result: str,
        k_factor: float = None
    ) -> Tuple[float, float]:
        """
        根据对战结果计算新的评分
        
        Args:
            rating_a: 模型 A 的当前评分
            rating_b: 模型 B 的当前评分
            result: 对战结果 "model_a"(A 胜), "model_b"(B 胜), "tie"(平局)
            k_factor: K 因子（可选，默认使用配置值）
            
        Returns:
            (模型 A 的新评分, 模型 B 的新评分)
        """
        if k_factor is None:
            k_factor = config.ELO_K_FACTOR
        
        # 计算期望得分
        expected_a, expected_b = RatingService.calculate_expected_score(rating_a, rating_b)
        
        # 确定实际得分
        if result == "model_a":
            actual_a, actual_b = 1.0, 0.0
        elif result == "model_b":
            actual_a, actual_b = 0.0, 1.0
        else:  # tie
            actual_a, actual_b = 0.5, 0.5
        
        # 计算新评分
        new_rating_a = rating_a + k_factor * (actual_a - expected_a)
        new_rating_b = rating_b + k_factor * (actual_b - expected_b)
        
        return new_rating_a, new_rating_b
    
    @staticmethod
    async def update_ratings(
        db: AsyncSession,
        model_a_id: str,
        model_b_id: str,
        winner: str
    ) -> Tuple[float, float]:
        """
        更新两个模型的评分
        
        Args:
            db: 数据库会话
            model_a_id: 模型 A 的 ID
            model_b_id: 模型 B 的 ID
            winner: 获胜者 "model_a", "model_b", 或 "tie"
            
        Returns:
            (模型 A 的新评分, 模型 B 的新评分)
        """
        # 获取当前评分
        result_a = await db.execute(
            select(ModelRating).where(ModelRating.model_id == model_a_id)
        )
        result_b = await db.execute(
            select(ModelRating).where(ModelRating.model_id == model_b_id)
        )
        
        model_a_rating = result_a.scalar_one_or_none()
        model_b_rating = result_b.scalar_one_or_none()

        # 如果评分表中不存在，补录一条初始记录（兼容新增模型或未初始化的模型）
        if model_a_rating is None:
            model_a_rating = ModelRating(
                model_id=model_a_id,
                model_name=model_a_id,
                rating=config.INITIAL_RATING,
                total_battles=0,
                wins=0,
                losses=0,
                ties=0
            )
            db.add(model_a_rating)

        if model_b_rating is None:
            model_b_rating = ModelRating(
                model_id=model_b_id,
                model_name=model_b_id,
                rating=config.INITIAL_RATING,
                total_battles=0,
                wins=0,
                losses=0,
                ties=0
            )
            db.add(model_b_rating)
        
        # 如果刚创建了新记录，需要先 flush 确保它们有 ID
        await db.flush()
        
        # 计算新评分
        new_rating_a, new_rating_b = RatingService.calculate_new_ratings(
            model_a_rating.rating,
            model_b_rating.rating,
            winner
        )
        
        # 更新模型 A 的评分和统计
        update_data_a = {
            "rating": new_rating_a,
            "total_battles": (model_a_rating.total_battles or 0) + 1
        }
        if winner == "model_a":
            update_data_a["wins"] = (model_a_rating.wins or 0) + 1
        elif winner == "model_b":
            update_data_a["losses"] = (model_a_rating.losses or 0) + 1
        else:
            update_data_a["ties"] = (model_a_rating.ties or 0) + 1
        
        await db.execute(
            update(ModelRating)
            .where(ModelRating.model_id == model_a_id)
            .values(**update_data_a)
        )
        
        # 更新模型 B 的评分和统计
        update_data_b = {
            "rating": new_rating_b,
            "total_battles": (model_b_rating.total_battles or 0) + 1
        }
        if winner == "model_b":
            update_data_b["wins"] = (model_b_rating.wins or 0) + 1
        elif winner == "model_a":
            update_data_b["losses"] = (model_b_rating.losses or 0) + 1
        else:
            update_data_b["ties"] = (model_b_rating.ties or 0) + 1
        
        await db.execute(
            update(ModelRating)
            .where(ModelRating.model_id == model_b_id)
            .values(**update_data_b)
        )
        
        await db.commit()
        
        return new_rating_a, new_rating_b
    
    @staticmethod
    async def get_leaderboard(db: AsyncSession, limit: int = 50):
        """
        获取排行榜
        
        Args:
            db: 数据库会话
            limit: 返回的模型数量限制
            
        Returns:
            排行榜列表
        """
        result = await db.execute(
            select(ModelRating)
            .order_by(ModelRating.rating.desc())
            .limit(limit)
        )
        
        models = result.scalars().all()
        
        leaderboard = []
        for rank, model in enumerate(models, start=1):
            win_rate = (model.wins / model.total_battles * 100) if model.total_battles > 0 else 0
            leaderboard.append({
                "rank": rank,
                "model_id": model.model_id,
                "model_name": model.model_name,
                "rating": round(model.rating, 1),
                "total_battles": model.total_battles,
                "wins": model.wins,
                "losses": model.losses,
                "ties": model.ties,
                "win_rate": round(win_rate, 1)
            })
        
        return leaderboard

