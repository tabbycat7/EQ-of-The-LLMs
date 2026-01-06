"""教学理念竞技场 API"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import random

from models.database import get_db
from models.schemas import PhilosophyRecord, PhilosophyVote, PhilosophyModelRating
from services.model_service import ModelService
from config import AVAILABLE_MODELS

router = APIRouter(prefix="/api/philosophy", tags=["philosophy"])
model_service = ModelService()


# ELO 评分相关常数
K_FACTOR = 32
INITIAL_RATING = 1000.0


class StartPhilosophyRequest(BaseModel):
    """开始教学理念竞技场请求"""
    pass


class StartPhilosophyResponse(BaseModel):
    """开始教学理念竞技场响应"""
    session_id: str


class PhilosophyChatRequest(BaseModel):
    """教学理念对话请求"""
    session_id: str
    message: str


class PhilosophyChatResponse(BaseModel):
    """教学理念对话响应"""
    model_config = {"protected_namespaces": ()}
    
    session_id: str
    model_a_response: str
    model_b_response: str


class PhilosophyEvaluationRequest(BaseModel):
    """教学理念评价请求"""
    session_id: str
    evaluation: Dict[str, Dict[str, int]]  # {"model_a": {"logic": 5, ...}, "model_b": {...}}


class EvaluationResponse(BaseModel):
    """评价响应"""
    success: bool
    message: str


class PhilosophyVoteRequest(BaseModel):
    """教学理念投票请求"""
    session_id: str
    winner: str  # "model_a", "model_b", "tie", "both_bad"


class VoteResponse(BaseModel):
    """投票响应"""
    model_config = {"protected_namespaces": ()}
    
    success: bool
    message: str
    model_a_name: str
    model_b_name: str
    model_a_rating: float
    model_b_rating: float


@router.post("/start", response_model=StartPhilosophyResponse)
async def start_philosophy(
    request: StartPhilosophyRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    开始新的对战会话
    """
    # 随机选择两个不同的模型
    if len(AVAILABLE_MODELS) < 2:
        raise HTTPException(status_code=400, detail="可用模型数量不足")
    
    selected_models = random.sample(AVAILABLE_MODELS, 2)
    model_a = selected_models[0]
    model_b = selected_models[1]
    
    # 创建新的竞技场记录
    philosophy_record = PhilosophyRecord(
        model_a_id=model_a["id"],
        model_b_id=model_b["id"],
        conversation=[]
    )
    
    db.add(philosophy_record)
    await db.commit()
    await db.refresh(philosophy_record)
    
    return StartPhilosophyResponse(session_id=philosophy_record.id)


@router.post("/chat", response_model=PhilosophyChatResponse)
async def philosophy_chat(
    request: PhilosophyChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    对话
    """
    # 获取会话
    result = await db.execute(
        select(PhilosophyRecord).where(PhilosophyRecord.id == request.session_id)
    )
    philosophy = result.scalar_one_or_none()
    
    if not philosophy:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    # 更新对话历史
    conversation = philosophy.conversation or []
    conversation.append({"role": "user", "content": request.message})
    philosophy.conversation = conversation
    
    # 构造提示消息（与教案质量竞技场一致）
    history = philosophy.conversation or []
    prompt_messages = list(history)
    prompt_messages.append(
        {
            "role": "user",
            "content": (
                "下面是用户本轮的提问。请直接回答问题本身，不要再问候、不做自我介绍，"
                "不要提及自己的模型名称或开发公司。\n"
                f"【用户问题】{request.message}"
            ),
        }
    )

    # 同时获取两个模型的完整回复
    response_a, response_b = await model_service.get_dual_completion(
        philosophy.model_a_id,
        philosophy.model_b_id,
        prompt_messages,
    )

    # 更新数据库中保存的完整对话历史
    new_history = history + [
        {"role": "user", "content": request.message},
        {"role": "assistant", "content": f"[Model A]: {response_a}"},
        {"role": "assistant", "content": f"[Model B]: {response_b}"},
    ]

    philosophy.conversation = new_history
    philosophy.model_a_response = response_a
    philosophy.model_b_response = response_b
    
    await db.commit()
    
    return PhilosophyChatResponse(
        session_id=philosophy.id,
        model_a_response=response_a,
        model_b_response=response_b
    )


@router.post("/evaluation", response_model=EvaluationResponse)
async def submit_philosophy_evaluation(
    request: PhilosophyEvaluationRequest,
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    提交测评维度数据（4个维度 - 5点李克特量表）
    
    注意：四个维度的评分（logic, perspective, care, inspiration）
    采用5点李克特量表（1-5分），会直接保存到 philosophy_records 表中。
    - 1分：非常不符合/完全未达到
    - 2分：不太符合/达到较少
    - 3分：一般/中等水平
    - 4分：较符合/达到较好
    - 5分：非常符合/达到很好
    
    这些评分仅用于记录和分析，不会影响 model_rating 的计算。
    model_rating 只根据投票结果（winner）更新。
    """
    # 获取竞技场会话
    result = await db.execute(
        select(PhilosophyRecord).where(PhilosophyRecord.id == request.session_id)
    )
    philosophy = result.scalar_one_or_none()
    
    if not philosophy:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    # 保存测评维度数据
    evaluation_data = request.evaluation
    
    # 更新模型 A 的测评维度
    if "model_a" in evaluation_data:
        model_a_eval = evaluation_data["model_a"]
        philosophy.model_a_logic = model_a_eval.get("logic")
        philosophy.model_a_perspective = model_a_eval.get("perspective")
        philosophy.model_a_care = model_a_eval.get("care")
        philosophy.model_a_inspiration = model_a_eval.get("inspiration")
    
    # 更新模型 B 的测评维度
    if "model_b" in evaluation_data:
        model_b_eval = evaluation_data["model_b"]
        philosophy.model_b_logic = model_b_eval.get("logic")
        philosophy.model_b_perspective = model_b_eval.get("perspective")
        philosophy.model_b_care = model_b_eval.get("care")
        philosophy.model_b_inspiration = model_b_eval.get("inspiration")
    
    await db.commit()
    
    return EvaluationResponse(
        success=True,
        message="测评维度提交成功"
    )


@router.post("/vote", response_model=VoteResponse)
async def submit_philosophy_vote(
    request: PhilosophyVoteRequest,
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    提交投票
    """
    # 获取竞技场会话
    result = await db.execute(
        select(PhilosophyRecord).where(PhilosophyRecord.id == request.session_id)
    )
    philosophy = result.scalar_one_or_none()
    
    if not philosophy:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    # 保存投票结果
    philosophy.winner = request.winner
    philosophy.is_revealed = 1
    
    # 获取模型名称
    model_a_name = next((m["name"] for m in AVAILABLE_MODELS if m["id"] == philosophy.model_a_id), "Unknown")
    model_b_name = next((m["name"] for m in AVAILABLE_MODELS if m["id"] == philosophy.model_b_id), "Unknown")
    
    # 创建投票记录
    vote = PhilosophyVote(
        philosophy_id=philosophy.id,
        winner=request.winner,
        model_a_id=philosophy.model_a_id,
        model_b_id=philosophy.model_b_id,
        user_prompt=philosophy.conversation[0]["content"] if philosophy.conversation else ""
    )
    db.add(vote)
    
    # 更新模型评分
    await update_philosophy_model_ratings(
        db,
        philosophy.model_a_id,
        model_a_name,
        philosophy.model_b_id,
        model_b_name,
        request.winner
    )
    
    # 获取更新后的评分
    result_a = await db.execute(
        select(PhilosophyModelRating).where(PhilosophyModelRating.model_id == philosophy.model_a_id)
    )
    rating_a = result_a.scalar_one_or_none()
    
    result_b = await db.execute(
        select(PhilosophyModelRating).where(PhilosophyModelRating.model_id == philosophy.model_b_id)
    )
    rating_b = result_b.scalar_one_or_none()
    
    # 保存当前评分到会话记录
    philosophy.model_a_rating = rating_a.rating if rating_a else INITIAL_RATING
    philosophy.model_b_rating = rating_b.rating if rating_b else INITIAL_RATING
    
    await db.commit()
    
    return VoteResponse(
        success=True,
        message="投票成功",
        model_a_name=model_a_name,
        model_b_name=model_b_name,
        model_a_rating=philosophy.model_a_rating,
        model_b_rating=philosophy.model_b_rating
    )


async def update_philosophy_model_ratings(
    db: AsyncSession,
    model_a_id: str,
    model_a_name: str,
    model_b_id: str,
    model_b_name: str,
    winner: str
):
    """
    更新模型评分（使用 ELO 算法）
    """
    # 获取或创建模型 A 的评分记录
    result_a = await db.execute(
        select(PhilosophyModelRating).where(PhilosophyModelRating.model_id == model_a_id)
    )
    rating_a = result_a.scalar_one_or_none()
    
    if not rating_a:
        rating_a = PhilosophyModelRating(
            model_id=model_a_id,
            model_name=model_a_name,
            rating=INITIAL_RATING,
            total_battles=0,
            wins=0,
            losses=0,
            ties=0
        )
        db.add(rating_a)
        await db.flush()  # 确保记录被创建并分配默认值
    
    # 获取或创建模型 B 的评分记录
    result_b = await db.execute(
        select(PhilosophyModelRating).where(PhilosophyModelRating.model_id == model_b_id)
    )
    rating_b = result_b.scalar_one_or_none()
    
    if not rating_b:
        rating_b = PhilosophyModelRating(
            model_id=model_b_id,
            model_name=model_b_name,
            rating=INITIAL_RATING,
            total_battles=0,
            wins=0,
            losses=0,
            ties=0
        )
        db.add(rating_b)
        await db.flush()  # 确保记录被创建并分配默认值
    
    # 计算期望胜率
    expected_a = 1 / (1 + 10 ** ((rating_b.rating - rating_a.rating) / 400))
    expected_b = 1 / (1 + 10 ** ((rating_a.rating - rating_b.rating) / 400))
    
    # 根据投票结果计算实际得分
    if winner == "model_a":
        score_a, score_b = 1.0, 0.0
        rating_a.wins += 1
        rating_b.losses += 1
    elif winner == "model_b":
        score_a, score_b = 0.0, 1.0
        rating_a.losses += 1
        rating_b.wins += 1
    elif winner == "tie":
        score_a, score_b = 0.0, 0.0  # 修改：平局时两个模型都不加分
        rating_a.ties += 1
        rating_b.ties += 1
    else:  # both_bad
        score_a, score_b = 0.0, 0.0
        rating_a.losses += 1
        rating_b.losses += 1
    
    # 更新评分
    rating_a.rating += K_FACTOR * (score_a - expected_a)
    rating_b.rating += K_FACTOR * (score_b - expected_b)
    
    # 更新对战次数
    rating_a.total_battles += 1
    rating_b.total_battles += 1
    
    await db.commit()


@router.get("/history")
async def get_philosophy_history(
    db: AsyncSession = Depends(get_db)
):
    """
    获取历史记录
    """
    result = await db.execute(
        select(PhilosophyRecord)
        .where(PhilosophyRecord.is_revealed == 1)
        .order_by(desc(PhilosophyRecord.created_at))
        .limit(50)
    )
    records = result.scalars().all()
    
    history = []
    for record in records:
        model_a_name = next((m["name"] for m in AVAILABLE_MODELS if m["id"] == record.model_a_id), "Unknown")
        model_b_name = next((m["name"] for m in AVAILABLE_MODELS if m["id"] == record.model_b_id), "Unknown")
        
        history.append({
            "id": record.id,
            "model_a_name": model_a_name,
            "model_b_name": model_b_name,
            "winner": record.winner,
            "question": record.conversation[0]["content"] if record.conversation else "",
            "model_a_response": record.model_a_response,
            "model_b_response": record.model_b_response,
            "created_at": record.created_at.isoformat() if record.created_at else None
        })
    
    return {"history": history}


@router.get("/leaderboard")
async def get_philosophy_leaderboard(
    db: AsyncSession = Depends(get_db)
):
    """
    获取排行榜
    """
    result = await db.execute(
        select(PhilosophyModelRating)
        .order_by(desc(PhilosophyModelRating.rating))
    )
    ratings = result.scalars().all()
    
    leaderboard = []
    for rating in ratings:
        leaderboard.append({
            "model_id": rating.model_id,
            "model_name": rating.model_name,
            "rating": round(rating.rating, 2),
            "total_battles": rating.total_battles,
            "wins": rating.wins,
            "losses": rating.losses,
            "ties": rating.ties,
            "win_rate": round((rating.wins / rating.total_battles * 100) if rating.total_battles > 0 else 0, 2)
        })
    
    return {"leaderboard": leaderboard}

