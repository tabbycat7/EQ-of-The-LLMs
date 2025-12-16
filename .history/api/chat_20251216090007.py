"""Chat 聊天模式 API（仅 Side-by-Side 对比模式）"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Optional

from models.database import get_db
from models.schemas import ChatSession
from services.model_service import ModelService
from services.rating_service import RatingService

router = APIRouter(prefix="/api/chat", tags=["chat"])
model_service = ModelService()


class SideBySideRequest(BaseModel):
    """并排对比请求"""
    model_config = ConfigDict(protected_namespaces=())
    
    model_a_id: str
    model_b_id: str
    message: str
    session_id: Optional[str] = None


class SideBySideResponse(BaseModel):
    """并排对比响应"""
    model_config = ConfigDict(protected_namespaces=())
    
    session_id: str
    model_a_id: str
    model_a_name: str
    model_b_id: str
    model_b_name: str
    response_a: str
    response_b: str


class ModelsListResponse(BaseModel):
    """模型列表响应"""
    models: List[Dict]


class SideBySideVoteRequest(BaseModel):
    """并排对比投票请求"""
    model_config = ConfigDict(protected_namespaces=())
    
    model_a_id: str
    model_b_id: str
    winner: str  # "model_a" | "model_b" | "tie"
    session_id: Optional[str] = None


class SideBySideVoteResponse(BaseModel):
    """并排对比投票响应"""
    success: bool
    message: str
    model_a_id: str
    model_a_name: str
    model_b_id: str
    model_b_name: str
    new_rating_a: float
    new_rating_b: float


@router.get("/models", response_model=ModelsListResponse)
async def get_models():
    """获取可用的模型列表"""
    models = model_service.get_available_models()
    return ModelsListResponse(models=models)


@router.post("/sidebyside", response_model=SideBySideResponse)
async def side_by_side_chat(
    request: SideBySideRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    并排对比模式
    同时查看两个模型的回答（非匿名）
    """
    # 验证模型是否存在
    model_a_info = model_service.get_model_info(request.model_a_id)
    model_b_info = model_service.get_model_info(request.model_b_id)
    
    if not model_a_info:
        raise HTTPException(status_code=404, detail=f"模型 {request.model_a_id} 不存在")
    if not model_b_info:
        raise HTTPException(status_code=404, detail=f"模型 {request.model_b_id} 不存在")
    
    # 获取或创建会话
    if request.session_id:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == request.session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
    else:
        session = ChatSession(
            mode="sidebyside",
            model_ids=[request.model_a_id, request.model_b_id],
            conversation=[]
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
    
    # 构建消息历史
    messages = session.conversation.copy() if session.conversation else []
    messages.append({"role": "user", "content": request.message})
    
    # 同时调用两个模型
    response_a, response_b = await model_service.get_dual_completion(
        request.model_a_id,
        request.model_b_id,
        messages
    )
    
    # 更新会话历史
    messages.append({
        "role": "assistant",
        "content": f"[{model_a_info['name']}]: {response_a}"
    })
    messages.append({
        "role": "assistant",
        "content": f"[{model_b_info['name']}]: {response_b}"
    })
    session.conversation = messages
    
    await db.commit()
    
    return SideBySideResponse(
        session_id=session.id,
        model_a_id=request.model_a_id,
        model_a_name=model_a_info["name"],
        model_b_id=request.model_b_id,
        model_b_name=model_b_info["name"],
        response_a=response_a,
        response_b=response_b
    )


@router.post("/sidebyside/vote", response_model=SideBySideVoteResponse)
async def side_by_side_vote(
    request: SideBySideVoteRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    并排对比模式下的投票
    直接根据用户选择更新 ELO 评分
    """
    if request.winner not in ["model_a", "model_b", "tie"]:
        raise HTTPException(status_code=400, detail="无效的投票选项")

    # 验证模型是否存在
    model_a_info = model_service.get_model_info(request.model_a_id)
    model_b_info = model_service.get_model_info(request.model_b_id)

    if not model_a_info:
        raise HTTPException(status_code=404, detail=f"模型 {request.model_a_id} 不存在")
    if not model_b_info:
        raise HTTPException(status_code=404, detail=f"模型 {request.model_b_id} 不存在")

    # 更新评分
    new_rating_a, new_rating_b = await RatingService.update_ratings(
        db,
        request.model_a_id,
        request.model_b_id,
        request.winner
    )

    return SideBySideVoteResponse(
        success=True,
        message="投票成功！感谢你的反馈。",
        model_a_id=request.model_a_id,
        model_a_name=model_a_info["name"],
        model_b_id=request.model_b_id,
        model_b_name=model_b_info["name"],
        new_rating_a=new_rating_a,
        new_rating_b=new_rating_b
    )
