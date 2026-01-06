"""用户信息管理API"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from models.database import get_db
from models.schemas import UserInfo
import uuid

router = APIRouter(prefix="/api/user", tags=["user"])


class UserInfoCreate(BaseModel):
    """用户信息创建请求"""
    region: str
    school: str
    subject: str
    grade: str


class UserInfoResponse(BaseModel):
    """用户信息响应"""
    id: str
    region: str
    school: str
    subject: str
    grade: str


@router.post("/info", response_model=UserInfoResponse)
async def create_user_info(
    user_data: UserInfoCreate,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    创建用户信息（首次访问）
    """
    # 创建新用户信息
    user_info = UserInfo(
        region=user_data.region,
        school=user_data.school,
        subject=user_data.subject,
        grade=user_data.grade
    )
    
    db.add(user_info)
    await db.commit()
    await db.refresh(user_info)
    
    # 设置cookie保存user_id（30天有效期）
    response.set_cookie(
        key="user_id",
        value=user_info.id,
        max_age=30 * 24 * 60 * 60,  # 30天
        httponly=True,
        samesite="lax"
    )
    
    return UserInfoResponse(
        id=user_info.id,
        region=user_info.region,
        school=user_info.school,
        subject=user_info.subject,
        grade=user_info.grade
    )


@router.get("/info", response_model=UserInfoResponse)
async def get_user_info(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    获取当前用户信息
    """
    # 从cookie获取user_id
    user_id = request.cookies.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=404, detail="用户信息不存在")
    
    # 查询用户信息
    result = await db.execute(
        select(UserInfo).where(UserInfo.id == user_id)
    )
    user_info = result.scalar_one_or_none()
    
    if not user_info:
        raise HTTPException(status_code=404, detail="用户信息不存在")
    
    return UserInfoResponse(
        id=user_info.id,
        region=user_info.region,
        school=user_info.school,
        subject=user_info.subject,
        grade=user_info.grade
    )


@router.get("/check")
async def check_user_info(request: Request):
    """
    检查用户是否已填写信息
    """
    user_id = request.cookies.get("user_id")
    
    return {
        "has_info": user_id is not None,
        "user_id": user_id
    }

