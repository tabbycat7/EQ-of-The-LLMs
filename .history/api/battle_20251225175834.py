"""Battle 对战模式 API"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
import random

from models.database import get_db, async_session_maker
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


class BattleHistoryItem(BaseModel):
    """历史对战记录项"""
    model_config = ConfigDict(protected_namespaces=())
    
    id: str
    model_a_id: str
    model_a_name: str
    model_b_id: str
    model_b_name: str
    conversation: List[dict]
    model_a_response: Optional[str]
    model_b_response: Optional[str]
    winner: Optional[str]
    is_revealed: int
    created_at: str
    updated_at: Optional[str]


class BattleHistoryResponse(BaseModel):
    """历史对战列表响应"""
    model_config = ConfigDict(protected_namespaces=())
    
    success: bool
    battles: List[BattleHistoryItem]
    total: int


class QuestionItem(BaseModel):
    """问题项"""
    model_config = ConfigDict(protected_namespaces=())
    
    question: str
    battle_id: str
    created_at: str
    is_question_valid: Optional[int] = None  # 1=符合要求，0=不符合要求，None=未标记


class QuestionsResponse(BaseModel):
    """问题列表响应"""
    model_config = ConfigDict(protected_namespaces=())
    
    success: bool
    questions: List[QuestionItem]
    total: int


class UpdateQuestionValidRequest(BaseModel):
    """更新问题有效性请求"""
    battle_id: str
    is_question_valid: int  # 1=符合要求，0=不符合要求


class UpdateQuestionValidResponse(BaseModel):
    """更新问题有效性响应"""
    model_config = ConfigDict(protected_namespaces=())
    
    success: bool
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
    - 不立即创建新的 Battle 记录，只有当用户真正发送消息时才创建
    - 返回原会话的 ID，前端用于标记"继续对话"模式
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

    # 不创建新记录，直接返回原会话ID
    # 当用户真正发送消息时，battle_chat 会检测到这是"继续对话"模式并创建新记录
    return ContinueBattleResponse(
        session_id=old_battle.id,  # 返回原会话ID，前端用它作为标记
        message="可以继续对话，请在下方输入框中发送消息。",
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
    # 获取当前登录用户ID（先不更新提问次数，等操作成功后再更新）
    current_user_id = None
    try:
        current_user_id = get_current_user(req)
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
        
        # 如果原会话已完成投票（winner 不为 NULL），说明这是"继续对话"模式
        # 需要创建新的 Battle 记录，复用模型和历史对话
        if battle.winner is not None:
            # 创建新的对战会话，复用模型与历史对话
            new_battle = Battle(
                user_id=current_user_id,
                model_a_id=battle.model_a_id,
                model_b_id=battle.model_b_id,
                conversation=battle.conversation.copy() if battle.conversation else [],
                is_revealed=0,
            )
            db.add(new_battle)
            await db.flush()  # flush 以获取新记录的 ID
            await db.refresh(new_battle)
            # 使用新创建的 battle 记录
            battle = new_battle

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
    
    # 更新用户提问次数（在对话成功后再更新，保证一致性）
    if current_user_id is not None:
        result = await db.execute(select(User).where(User.id == current_user_id))
        user = result.scalar_one_or_none()
        if user:
            user.question_count = (user.question_count or 0) + 1

    await db.commit()

    return ChatResponse(
        session_id=battle.id,
        response_a=response_a,
        response_b=response_b,
    )


@router.post("/evaluation", response_model=EvaluationResponse)
async def submit_evaluation(
    request: EvaluationRequest,
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    提交测评维度数据
    
    注意：四个维度的评分（perception, calibration, differentiation, regulation）
    仅用于记录和分析，不会影响 model_rating 的计算。
    model_rating 只根据投票结果（winner）更新。
    """
    # 获取当前登录用户ID
    current_user_id = None
    try:
        current_user_id = get_current_user(req)
    except HTTPException:
        pass  # 如果未登录，user_id为None
    
    # 获取对战会话
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
    
    # 保存测评维度数据
    evaluation_data = request.evaluation
    for model_type in ["model_a", "model_b"]:
        if model_type in evaluation_data:
            model_eval = evaluation_data[model_type]
            # 根据model_type获取对应的模型ID
            model_id = battle.model_a_id if model_type == "model_a" else battle.model_b_id
            eval_record = BattleEvaluation(
                battle_id=battle.id,
                model_type=model_type,
                model_id=model_id,
                perception=model_eval.get("perception"),
                calibration=model_eval.get("calibration"),
                differentiation=model_eval.get("differentiation"),
                regulation=model_eval.get("regulation")
            )
            db.add(eval_record)
    
    await db.commit()
    
    return EvaluationResponse(
        success=True,
        message="测评维度提交成功"
    )


@router.post("/vote", response_model=VoteResponse)
async def submit_vote(
    request: VoteRequest,
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    提交投票并更新积分制评分
    投票后揭示模型身份
    """
    # 获取当前登录用户ID
    current_user_id = None
    try:
        current_user_id = get_current_user(req)
    except HTTPException:
        pass  # 如果未登录，user_id为None
    
    # 使用 SELECT FOR UPDATE 锁定行，防止并发投票
    result = await db.execute(
        select(Battle)
        .where(Battle.id == request.session_id)
        .with_for_update()  # 锁定这一行，防止并发修改
    )
    battle = result.scalar_one_or_none()
    
    if not battle:
        raise HTTPException(status_code=404, detail="对战会话不存在")
    
    # 验证会话是否属于当前用户（如果用户已登录）
    if current_user_id is not None:
        if battle.user_id != current_user_id:
            raise HTTPException(status_code=403, detail="无权访问此对战会话")
    
    # 检查是否已经投过票（winner 不为 None 且不为空字符串）
    # 如果已经投过票，采用幂等性处理：返回成功响应而不是错误
    # 这样可以避免因重复提交导致的400错误，同时数据已经正确记录了
    if battle.winner is not None:
        winner_str = str(battle.winner).strip()
        if winner_str:  # 如果 winner 不是空字符串，说明已经投过票
            # 释放锁，因为不需要更新数据
            await db.rollback()
            
            # 使用新的查询获取最新的数据（不在事务中，避免锁问题）
            async with async_session_maker() as new_db:
                latest_result = await new_db.execute(
                    select(Battle).where(Battle.id == request.session_id)
                )
                latest_battle = latest_result.scalar_one_or_none()
                
                if not latest_battle:
                    raise HTTPException(status_code=404, detail="对战会话不存在")
                
                # 获取模型名称
                model_a_info = model_service.get_model_info(latest_battle.model_a_id)
                model_b_info = model_service.get_model_info(latest_battle.model_b_id)
                
                # 获取当前的评分
                from models.schemas import ModelRating
                rating_result_a = await new_db.execute(
                    select(ModelRating).where(ModelRating.model_id == latest_battle.model_a_id)
                )
                rating_result_b = await new_db.execute(
                    select(ModelRating).where(ModelRating.model_id == latest_battle.model_b_id)
                )
                rating_a = rating_result_a.scalar_one_or_none()
                rating_b = rating_result_b.scalar_one_or_none()
                current_rating_a = rating_a.rating if rating_a else 0
                current_rating_b = rating_b.rating if rating_b else 0
                
                return VoteResponse(
                    success=True,
                    message="该对战已经投过票了，返回已有结果。",
                    model_a_id=latest_battle.model_a_id,
                    model_a_name=model_a_info["name"] if model_a_info else latest_battle.model_a_id,
                    model_b_id=latest_battle.model_b_id,
                    model_b_name=model_b_info["name"] if model_b_info else latest_battle.model_b_id,
                    new_rating_a=current_rating_a,
                    new_rating_b=current_rating_b
                )
    
    if request.winner not in ["model_a", "model_b", "tie", "both_bad"]:
        await db.rollback()  # 释放锁
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
    # 只选择有效的问题计算（标记为1），如果is_question_valid标记为NULL，则默认有效
    # 如果is_question_valid为0，则不更新评分
    new_rating_a = None
    new_rating_b = None
    if battle.is_question_valid is None or battle.is_question_valid == 1:
        new_rating_a, new_rating_b = await RatingService.update_ratings(
            db,
            battle.model_a_id,
            battle.model_b_id,
            request.winner,
            source="battle",
        )
    else:
        # is_question_valid 为 0，不更新评分，使用当前评分
        from models.schemas import ModelRating
        rating_result_a = await db.execute(
            select(ModelRating).where(ModelRating.model_id == battle.model_a_id)
        )
        rating_result_b = await db.execute(
            select(ModelRating).where(ModelRating.model_id == battle.model_b_id)
        )
        rating_a = rating_result_a.scalar_one_or_none()
        rating_b = rating_result_b.scalar_one_or_none()
        new_rating_a = rating_a.rating if rating_a else config.INITIAL_RATING
        new_rating_b = rating_b.rating if rating_b else config.INITIAL_RATING
    
    # 更新 BattleEvaluation 记录中的 rating 值（仅用于记录投票后的评分快照，不用于计算）
    # 注意：四个维度的评分（perception, calibration, differentiation, regulation）不影响 model_rating
    result_a = await db.execute(
        select(BattleEvaluation).where(
            BattleEvaluation.battle_id == battle.id,
            BattleEvaluation.model_type == "model_a"
        )
    )
    eval_a = result_a.scalar_one_or_none()
    if eval_a:
        eval_a.rating = new_rating_a  # 仅记录，不参与计算
    
    result_b = await db.execute(
        select(BattleEvaluation).where(
            BattleEvaluation.battle_id == battle.id,
            BattleEvaluation.model_type == "model_b"
        )
    )
    eval_b = result_b.scalar_one_or_none()
    if eval_b:
        eval_b.rating = new_rating_b  # 仅记录，不参与计算
    
    # 提交事务
    await db.commit()
    # 刷新对象状态，确保数据一致
    await db.refresh(battle)
    
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


@router.get("/history", response_model=BattleHistoryResponse)
async def get_battle_history(
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    获取当前用户的对战历史记录
    """
    # 获取当前登录用户ID
    try:
        current_user_id = get_current_user(req)
    except HTTPException:
        raise HTTPException(status_code=401, detail="请先登录")
    
    # 查询当前用户的所有对战记录，按创建时间倒序
    # 过滤掉 winner 为 NULL 的记录（未完成投票的对战）
    from sqlalchemy import desc
    result = await db.execute(
        select(Battle)
        .where(
            Battle.user_id == current_user_id,
            Battle.winner.isnot(None)
        )
        .order_by(desc(Battle.created_at))
    )
    battles = result.scalars().all()
    
    # 转换为响应格式
    battle_items = []
    for battle in battles:
        model_a_info = model_service.get_model_info(battle.model_a_id)
        model_b_info = model_service.get_model_info(battle.model_b_id)
        
        battle_items.append(BattleHistoryItem(
            id=battle.id,
            model_a_id=battle.model_a_id,
            model_a_name=model_a_info["name"] if model_a_info else battle.model_a_id,
            model_b_id=battle.model_b_id,
            model_b_name=model_b_info["name"] if model_b_info else battle.model_b_id,
            conversation=battle.conversation or [],
            model_a_response=battle.model_a_response,
            model_b_response=battle.model_b_response,
            winner=battle.winner,
            is_revealed=battle.is_revealed or 0,
            created_at=battle.created_at.isoformat() if battle.created_at else "",
            updated_at=battle.updated_at.isoformat() if battle.updated_at else None
        ))
    
    return BattleHistoryResponse(
        success=True,
        battles=battle_items,
        total=len(battle_items)
    )


@router.get("/questions", response_model=QuestionsResponse)
async def get_user_questions(
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    获取当前用户提出的所有历史问题
    """
    # 获取当前登录用户ID
    try:
        current_user_id = get_current_user(req)
    except HTTPException:
        raise HTTPException(status_code=401, detail="请先登录")
    
    # 查询当前用户的所有对战记录，按创建时间倒序
    from sqlalchemy import desc
    result = await db.execute(
        select(Battle)
        .where(Battle.user_id == current_user_id)
        .order_by(desc(Battle.created_at))
    )
    battles = result.scalars().all()
    
    # 从对话历史中提取所有用户问题
    # 注意：每个 Battle 记录对应一轮对话，但 conversation 可能包含历史对话
    # 我们只提取每个 Battle 的最后一个用户消息（即当前轮次的问题）
    question_items = []
    
    for battle in battles:
        if battle.conversation:
            # 找到最后一个用户消息（当前轮次的问题）
            last_user_question = None
            for msg in reversed(battle.conversation):  # 从后往前遍历
                if msg.get("role") == "user":
                    last_user_question = msg.get("content", "").strip()
                    break  # 找到最后一个用户消息后停止
            
            if last_user_question:
                question_items.append(QuestionItem(
                    question=last_user_question,
                    battle_id=battle.id,
                    created_at=battle.created_at.isoformat() if battle.created_at else "",
                    is_question_valid=battle.is_question_valid
                ))
    
    # 按创建时间倒序排序（最新的在前）
    question_items.sort(key=lambda x: x.created_at, reverse=True)
    
    return QuestionsResponse(
        success=True,
        questions=question_items,
        total=len(question_items)
    )


@router.post("/questions/update-valid", response_model=UpdateQuestionValidResponse)
async def update_question_valid(
    request: UpdateQuestionValidRequest,
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    更新问题的有效性标记
    """
    # 获取当前登录用户ID
    try:
        current_user_id = get_current_user(req)
    except HTTPException:
        raise HTTPException(status_code=401, detail="请先登录")
    
    # 验证is_question_valid的值
    if request.is_question_valid not in [0, 1]:
        raise HTTPException(status_code=400, detail="is_question_valid必须是0或1")
    
    # 查询对应的battle记录
    result = await db.execute(
        select(Battle).where(Battle.id == request.battle_id)
    )
    battle = result.scalar_one_or_none()
    
    if not battle:
        raise HTTPException(status_code=404, detail="对战记录不存在")
    
    # 验证battle是否属于当前用户
    if battle.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="无权修改此问题")
    
    # 更新is_question_valid字段
    battle.is_question_valid = request.is_question_valid
    await db.commit()
    await db.refresh(battle)
    
    return UpdateQuestionValidResponse(
        success=True,
        message="问题有效性标记已更新"
    )


@router.get("/reveal/{session_id}", response_model=RevealResponse)
async def reveal_models(
    session_id: str,
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    揭示对战中的模型身份
    只有投票后才能查看
    """
    # 获取当前登录用户ID
    current_user_id = None
    try:
        current_user_id = get_current_user(req)
    except HTTPException:
        pass  # 如果未登录，user_id为None
    
    result = await db.execute(
        select(Battle).where(Battle.id == session_id)
    )
    battle = result.scalar_one_or_none()
    
    if not battle:
        raise HTTPException(status_code=404, detail="对战会话不存在")
    
    # 验证会话是否属于当前用户（如果用户已登录）
    if current_user_id is not None:
        if battle.user_id != current_user_id:
            raise HTTPException(status_code=403, detail="无权访问此对战会话")
    
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

