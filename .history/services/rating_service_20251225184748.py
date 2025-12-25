"""评分系统服务（积分制：胜+2，平+1，负+0）"""
from typing import Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from models.schemas import ModelRating, Vote
import config
from services.model_service import ModelService


class RatingService:
    """评分系统服务（积分制）"""

    @staticmethod
    def calculate_new_ratings(
        rating_a: float,
        rating_b: float,
        result: str,
    ) -> Tuple[float, float]:
        """
        积分制：
        - A 胜：A +2，B +0
        - B 胜：A +0，B +2
        - 平局：A +1，B +1
        - 两个都不好：A +0，B +0
        """
        if result == "model_a":
            return rating_a + config.WIN_POINTS, rating_b + config.LOSS_POINTS
        if result == "model_b":
            return rating_a + config.LOSS_POINTS, rating_b + config.WIN_POINTS
        if result == "both_bad":
            return rating_a + 0, rating_b + 0
        # tie
        return rating_a + config.TIE_POINTS, rating_b + config.TIE_POINTS
    
    @staticmethod
    async def update_ratings(
        db: AsyncSession,
        model_a_id: str,
        model_b_id: str,
        winner: str,
        source: str = "battle",  # 目前仅 battle 会调用；side-by-side 已不计入评分
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
            # 从配置中获取模型的真实名称
            model_a_info = ModelService.get_model_info(model_a_id)
            model_a_name = model_a_info["name"] if model_a_info else model_a_id
            model_a_rating = ModelRating(
                model_id=model_a_id,
                model_name=model_a_name,
                rating=config.INITIAL_RATING,
                total_battles=0,
                wins=0,
                losses=0,
                ties=0,
                wins_valid=0,
                tie_valid=0
            )
            db.add(model_a_rating)

        if model_b_rating is None:
            # 从配置中获取模型的真实名称
            model_b_info = ModelService.get_model_info(model_b_id)
            model_b_name = model_b_info["name"] if model_b_info else model_b_id
            model_b_rating = ModelRating(
                model_id=model_b_id,
                model_name=model_b_name,
                rating=config.INITIAL_RATING,
                total_battles=0,
                wins=0,
                losses=0,
                ties=0,
                wins_valid=0,
                tie_valid=0
            )
            db.add(model_b_rating)
        
        # 如果刚创建了新记录，需要先 flush 确保它们有 ID
        await db.flush()
        
        # 计算新评分（积分制）
        new_rating_a, new_rating_b = RatingService.calculate_new_ratings(
            model_a_rating.rating,
            model_b_rating.rating,
            winner,
        )
        
        # 更新模型 A 的评分和统计
        update_data_a = {
            "rating": new_rating_a,
            "total_battles": (model_a_rating.total_battles or 0) + 1
        }
        if winner == "model_a":
            update_data_a["wins"] = (model_a_rating.wins or 0) + 1
            update_data_a["wins_valid"] = (model_a_rating.wins_valid or 0) + 1  # 有效胜利次数
        elif winner == "model_b":
            update_data_a["losses"] = (model_a_rating.losses or 0) + 1
        elif winner == "both_bad":
            # 两个都不好，不增加wins/losses/ties
            pass
        else:  # tie
            update_data_a["ties"] = (model_a_rating.ties or 0) + 1
            update_data_a["tie_valid"] = (model_a_rating.tie_valid or 0) + 1  # 有效平局次数
        
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
            update_data_b["wins_valid"] = (model_b_rating.wins_valid or 0) + 1  # 有效胜利次数
        elif winner == "model_a":
            update_data_b["losses"] = (model_b_rating.losses or 0) + 1
        elif winner == "both_bad":
            # 两个都不好，不增加wins/losses/ties
            pass
        else:  # tie
            update_data_b["ties"] = (model_b_rating.ties or 0) + 1
            update_data_b["tie_valid"] = (model_b_rating.tie_valid or 0) + 1  # 有效平局次数
        
        await db.execute(
            update(ModelRating)
            .where(ModelRating.model_id == model_b_id)
            .values(**update_data_b)
        )
        
        # 注意：不在这里 commit，让调用者统一管理事务
        # 这样可以确保评分更新与其他操作（如投票记录）在同一事务中
        # await db.commit()  # 移除，由调用者控制事务
        
        return new_rating_a, new_rating_b
    
    @staticmethod
    async def revert_ratings(
        db: AsyncSession,
        model_a_id: str,
        model_b_id: str,
        winner: str,
    ) -> Tuple[float, float]:
        """
        撤销评分更新（反向操作）
        用于当问题被标记为无效时，撤销之前对评分的影响
        
        Args:
            db: 数据库会话
            model_a_id: 模型 A 的 ID
            model_b_id: 模型 B 的 ID
            winner: 之前的获胜者 "model_a", "model_b", 或 "tie"
            
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
        
        if not model_a_rating or not model_b_rating:
            # 如果评分记录不存在，无法撤销
            rating_a = model_a_rating.rating if model_a_rating else config.INITIAL_RATING
            rating_b = model_b_rating.rating if model_b_rating else config.INITIAL_RATING
            return rating_a, rating_b
        
        # 反向计算评分（减去之前添加的分数）
        if winner == "model_a":
            new_rating_a = model_a_rating.rating - config.WIN_POINTS
            new_rating_b = model_b_rating.rating - config.LOSS_POINTS
        elif winner == "model_b":
            new_rating_a = model_a_rating.rating - config.LOSS_POINTS
            new_rating_b = model_b_rating.rating - config.WIN_POINTS
        elif winner == "both_bad":
            new_rating_a = model_a_rating.rating  # 两个都不好，没有加分，所以不需要减
            new_rating_b = model_b_rating.rating
        else:  # tie
            new_rating_a = model_a_rating.rating - config.TIE_POINTS
            new_rating_b = model_b_rating.rating - config.TIE_POINTS
        
        # 确保评分不为负数
        new_rating_a = max(0, new_rating_a)
        new_rating_b = max(0, new_rating_b)
        
        # 更新模型 A 的评分和统计
        update_data_a = {
            "rating": new_rating_a,
            "total_battles": max(0, (model_a_rating.total_battles or 0) - 1)
        }
        if winner == "model_a":
            update_data_a["wins"] = max(0, (model_a_rating.wins or 0) - 1)
            update_data_a["wins_valid"] = max(0, (model_a_rating.wins_valid or 0) - 1)  # 有效胜利次数
        elif winner == "model_b":
            update_data_a["losses"] = max(0, (model_a_rating.losses or 0) - 1)
        elif winner == "both_bad":
            # 两个都不好，不减少wins/losses/ties
            pass
        else:  # tie
            update_data_a["ties"] = max(0, (model_a_rating.ties or 0) - 1)
            update_data_a["tie_valid"] = max(0, (model_a_rating.tie_valid or 0) - 1)  # 有效平局次数
        
        await db.execute(
            update(ModelRating)
            .where(ModelRating.model_id == model_a_id)
            .values(**update_data_a)
        )
        
        # 更新模型 B 的评分和统计
        update_data_b = {
            "rating": new_rating_b,
            "total_battles": max(0, (model_b_rating.total_battles or 0) - 1)
        }
        if winner == "model_b":
            update_data_b["wins"] = max(0, (model_b_rating.wins or 0) - 1)
            update_data_b["wins_valid"] = max(0, (model_b_rating.wins_valid or 0) - 1)  # 有效胜利次数
        elif winner == "model_a":
            update_data_b["losses"] = max(0, (model_b_rating.losses or 0) - 1)
        elif winner == "both_bad":
            # 两个都不好，不减少wins/losses/ties
            pass
        else:  # tie
            update_data_b["ties"] = max(0, (model_b_rating.ties or 0) - 1)
            update_data_b["tie_valid"] = max(0, (model_b_rating.tie_valid or 0) - 1)  # 有效平局次数
        
        await db.execute(
            update(ModelRating)
            .where(ModelRating.model_id == model_b_id)
            .values(**update_data_b)
        )
        
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
                "rating": int(model.rating),
                "total_battles": model.total_battles,
                "wins": model.wins,
                "losses": model.losses,
                "ties": model.ties,
                "win_rate": round(win_rate, 1)
            })
        
        return leaderboard

