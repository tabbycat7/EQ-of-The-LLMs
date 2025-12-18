"""Battle 对战模式 API"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
import random

from models.database import get_db
from models.schemas import Battle, Vote, User, BattleEvaluation
from services.model_service import ModelService
from services.rating_service import RatingService
from api.auth import get_current_user
import config

router = APIRouter(prefix="/api/battle", tags=["battle"])
model_service = ModelService()


class StartBattleResponse(BaseModel):
    """开始对战响应"""
    session_id: str
    message: str


class ChatRequest(BaseModel):
    """聊天请求"""
    session_id: Optional[str] = None
    message: str


class ChatResponse(BaseModel):
    """聊天响应"""
    session_id: str
    response_a: str
    response_b: str


class EvaluationRequest(BaseModel):
    """测评维度请求"""
    session_id: str
    evaluation: dict  # {"model_a": {"perception": 1, "calibration": 1, ...}, "model_b": {...}}


class EvaluationResponse(BaseModel):
    """测评维度响应"""
    success: bool
    message: str


class VoteRequest(BaseModel):
    """投票请求"""
    session_id: str
    winner: str  # "model_a", "model_b", "tie", "both_bad"


class VoteResponse(BaseModel):
    """投票响应"""
    model_config = ConfigDict(protected_namespaces=())
    
    success: bool
    message: str
    model_a_id: str
    model_a_name: str
    model_b_id: str
    model_b_name: str
    new_rating_a: float
    new_rating_b: float


class RevealResponse(BaseModel):
    """揭示模型身份响应"""
    model_config = ConfigDict(protected_namespaces=())
    
    model_a_id: str
    model_a_name: str
    model_b_id: str
    model_b_name: str
    winner: Optional[str]


class ContinueBattleRequest(BaseModel):
    """继续当前模型对战，请求体"""
    session_id: str


class ContinueBattleResponse(BaseModel):
    """继续当前模型对战，响应体"""
    session_id: str
    message: str


@router.post("/start", response_model=StartBattleResponse)
async def start_battle(db: AsyncSession = Depends(get_db)):
    """
    开始新的对战会话
    随机选择两个不同的模型
    """
    return StartBattleResponse(
        session_id="",
        message="对战开始！请输入你的问题，两个匿名模型将同时回答。"
    )


@router.post("/continue", response_model=ContinueBattleResponse)
async def continue_battle(
    request: ContinueBattleRequest,
    req: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    在当前两模型基础上继续新的对战轮次：
    - 复用原对战的 model_a / model_b
    - 复制历史对话作为新对战的初始 conversation
    - 返回一个新的 session_id，避免重复投票报错
    """
    # 获取当前登录用户ID
    current_user_id = None
    try:
        current_user_id = get_current_user(req)
    except HTTPException:
        pass  # 如果未登录，user_id为None
    
    # 查找原对战
    result = await db.execute(
        select(Battle).where(Battle.id == request.session_id)
    )
    old_battle = result.scalar_one_or_none()

    if not old_battle:
        raise HTTPException(status_code=404, detail="原对战会话不存在")
    
    # 验证原对战会话是否属于当前用户（如果用户已登录）
    if current_user_id is not None:
        if old_battle.user_id != current_user_id:
            raise HTTPException(status_code=403, detail="无权访问此对战会话")

    # 创建新的对战会话，复用模型与历史对话
    new_battle = Battle(
        user_id=current_user_id,
        model_a_id=old_battle.model_a_id,
        model_b_id=old_battle.model_b_id,
        conversation=old_battle.conversation or [],
        is_revealed=0,
    )

    db.add(new_battle)
    await db.commit()
    await db.refresh(new_battle)

    return ContinueBattleResponse(
        session_id=new_battle.id,
        message="已继续当前模型进行新一轮对战。",
    )


@router.post("/chat", response_model=ChatResponse)
async def battle_chat(
    request: ChatRequest,
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    在对战模式下发送消息
    两个模型一次性回复（非流式）
    """
    # 获取当前登录用户并更新提问次数
    current_user_id = None
    try:
        current_user_id = get_current_user(req)
        # 更新用户提问次数
        result = await db.execute(select(User).where(User.id == current_user_id))
        user = result.scalar_one_or_none()
        if user:
            user.question_count = (user.question_count or 0) + 1
            await db.commit()
    except HTTPException:
        # 如果未登录，继续执行但不更新提问次数
        pass
    
    # 如果没有 session_id，说明是本轮首次提问：此时创建对战会话
    if not request.session_id:
        # 基于模型 id 去重后，随机选择两个不同的模型
        available_models = config.AVAILABLE_MODELS
        unique_models_dict = {}
        for m in available_models:
            unique_models_dict[m["id"]] = m
        unique_models = list(unique_models_dict.values())

        if len(unique_models) < 2:
            raise HTTPException(status_code=500, detail="可用模型数量不足（至少需要 2 个不同的模型）")

        model_a, model_b = random.sample(unique_models, 2)

        battle = Battle(
            user_id=current_user_id,
            model_a_id=model_a["id"],
            model_b_id=model_b["id"],
            conversation=[],
            is_revealed=0,
        )
        db.add(battle)
        await db.commit()
        await db.refresh(battle)
    else:
        # 使用已有对战会话
        result = await db.execute(
            select(Battle).where(Battle.id == request.session_id)
        )
        battle = result.scalar_one_or_none()

        if not battle:
            raise HTTPException(status_code=404, detail="对战会话不存在")
        
        # 验证会话是否属于当前用户（如果用户已登录）
        if current_user_id is not None:
            if battle.user_id != current_user_id:
                raise HTTPException(status_code=403, detail="无权访问此对战会话")

    # 1) 读取已保存的历史对话（用于持久化）
    history = battle.conversation.copy() if battle.conversation else []

    # 2) 构建发给大模型的消息：
    #    将历史对话打包到一个带标签的 system 消息中，避免直接混入当前对话造成干扰
    prompt_messages = []

    if history:
        history_lines = []
        for msg in history:
            role = msg.get("role", "assistant")
            content = msg.get("content", "")
            history_lines.append(f"{role}: {content}")

        history_text = "\n".join(history_lines)
        if history_text.strip():
            prompt_messages.append(
                {
                    "role": "system",
                    "content": (
                        "你是一个匿名的大语言模型，用于参与评测。\n"
                        "要求：\n"
                        "1. 不要透露自己的真实模型名称、供应商（例如不要说“我是 Claude / GPT / DeepSeek 等”）。\n"
                        "2. 不要做长篇的自我介绍，直接高质量回答用户当前的问题即可。\n"
                        "3. 可以参考下面的历史对话来理解上下文，但回答时请聚焦当前这一轮问题，避免重复历史内容。\n"
                        "【历史对话开始】\n"
                        f"{history_text}\n"
                        "【历史对话结束】"
                    ),
                }
            )

    # 当前轮次的用户问题（仅用于本次回复）
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
        battle.model_a_id,
        battle.model_b_id,
        prompt_messages,
    )

    # 3) 更新数据库中保存的完整对话历史（逐轮追加，不覆盖旧记录）
    new_history = history + [
        {"role": "user", "content": request.message},
        {"role": "assistant", "content": f"[Model A]: {response_a}"},
        {"role": "assistant", "content": f"[Model B]: {response_b}"},
    ]

    battle.conversation = new_history
    battle.model_a_response = response_a
    battle.model_b_response = response_b

    await db.commit()

    return ChatResponse(
        session_id=battle.id,
        response_a=response_a,
        response_b=response_b,
    )


@router.post("/vote", response_model=VoteResponse)
async def submit_vote(
    request: VoteRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    提交投票并更新积分制评分
    投票后揭示模型身份
    """
    # 获取对战会话
    result = await db.execute(
        select(Battle).where(Battle.id == request.session_id)
    )
    battle = result.scalar_one_or_none()
    
    if not battle:
        raise HTTPException(status_code=404, detail="对战会话不存在")
    
    if battle.winner:
        raise HTTPException(status_code=400, detail="该对战已经投过票了")
    
    if request.winner not in ["model_a", "model_b", "tie", "both_bad"]:
        raise HTTPException(status_code=400, detail="无效的投票选项")
    
    # 更新对战结果
    battle.winner = request.winner
    battle.is_revealed = 1
    
    # 记录投票
    user_prompt = ""
    if battle.conversation:
        # 取最近一轮用户问题（从后往前找第一个 role=user）
        for msg in reversed(battle.conversation):
            if msg.get("role") == "user":
                user_prompt = msg.get("content", "")
                break
    
    vote = Vote(
        battle_id=battle.id,
        winner=request.winner,
        model_a_id=battle.model_a_id,
        model_b_id=battle.model_b_id,
        user_prompt=user_prompt
    )
    db.add(vote)
    
    # 更新评分（积分制）
    new_rating_a, new_rating_b = await RatingService.update_ratings(
        db,
        battle.model_a_id,
        battle.model_b_id,
        request.winner,
        source="battle",
    )
    
    await db.commit()
    
    # 获取模型名称
    model_a_info = model_service.get_model_info(battle.model_a_id)
    model_b_info = model_service.get_model_info(battle.model_b_id)
    
    return VoteResponse(
        success=True,
        message="投票成功！感谢你的参与。",
        model_a_id=battle.model_a_id,
        model_a_name=model_a_info["name"] if model_a_info else battle.model_a_id,
        model_b_id=battle.model_b_id,
        model_b_name=model_b_info["name"] if model_b_info else battle.model_b_id,
        new_rating_a=new_rating_a,
        new_rating_b=new_rating_b
    )


@router.get("/reveal/{session_id}", response_model=RevealResponse)
async def reveal_models(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    揭示对战中的模型身份
    只有投票后才能查看
    """
    result = await db.execute(
        select(Battle).where(Battle.id == session_id)
    )
    battle = result.scalar_one_or_none()
    
    if not battle:
        raise HTTPException(status_code=404, detail="对战会话不存在")
    
    if not battle.is_revealed:
        raise HTTPException(status_code=403, detail="请先投票后再查看模型身份")
    
    model_a_info = model_service.get_model_info(battle.model_a_id)
    model_b_info = model_service.get_model_info(battle.model_b_id)
    
    return RevealResponse(
        model_a_id=battle.model_a_id,
        model_a_name=model_a_info["name"] if model_a_info else battle.model_a_id,
        model_b_id=battle.model_b_id,
        model_b_name=model_b_info["name"] if model_b_info else battle.model_b_id,
        winner=battle.winner
    )

