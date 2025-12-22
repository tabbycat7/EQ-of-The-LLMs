"""登录认证API"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct
from pydantic import BaseModel
from typing import Optional, List, Dict, Union
from datetime import datetime, timedelta
import bcrypt

from models.database import get_db
from models.schemas import User, Battle

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    """登录请求"""
    user_id: str
    password: str


class LoginResponse(BaseModel):
    """登录响应"""
    success: bool
    message: str
    user_id: Optional[str] = None


class CreateUserRequest(BaseModel):
    """管理员添加用户请求"""
    user_id: str
    password: str


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    try:
        # 使用bcrypt验证密码
        password_bytes = plain_password.encode("utf-8")
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


@router.post("/login", response_model=LoginResponse)
async def login(
    request_data: LoginRequest,
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """用户登录"""
    # 查询用户
    result = await db.execute(select(User).where(User.id == request_data.user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    # 验证密码
    if not verify_password(request_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    # 在请求的session中存储用户ID
    req.session["user_id"] = user.id
    
    return LoginResponse(
        success=True,
        message="登录成功",
        user_id=user.id
    )


@router.get("/check", response_model=LoginResponse)
async def check_auth(req: Request):
    """检查登录状态"""
    user_id = req.session.get("user_id")
    if user_id:
        return LoginResponse(
            success=True,
            message="已登录",
            user_id=user_id
        )
    else:
        return LoginResponse(
            success=False,
            message="未登录",
            user_id=None
        )


@router.post("/logout")
async def logout(req: Request):
    """退出登录"""
    req.session.clear()
    return {"success": True, "message": "已退出登录"}


@router.post("/users")
async def create_user(
    request_data: CreateUserRequest,
    req: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    管理员添加新用户
    仅 admin 账号可以调用
    """
    current_user_id = get_current_user(req)
    if current_user_id != "admin":
        raise HTTPException(status_code=403, detail="只有 admin 可以添加用户")

    # 检查用户是否已存在
    result = await db.execute(select(User).where(User.id == request_data.user_id))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="该用户已存在")

    # 生成密码哈希（与导入 Excel 时保持一致的 bcrypt 规则）
    password_bytes = request_data.password.encode("utf-8")
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    password_hash = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")

    user = User(
        id=request_data.user_id,
        password_hash=password_hash,
        question_count=0,
    )
    db.add(user)
    await db.commit()

    return {"success": True, "message": "用户创建成功"}


def get_current_user(req: Request):
    """获取当前登录用户ID（依赖函数）"""
    user_id = req.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="未登录")
    return user_id


class DailyBattleItem(BaseModel):
    """每日作答数量项"""
    date: str  # 日期字符串，格式：YYYY-MM-DD
    count: int  # 该日的作答数量


class StatisticsResponse(BaseModel):
    """统计数据响应"""
    total_users: int  # 总用户数
    active_users: int  # 当前作答人数（有提问记录的用户）
    total_battles: int  # 总测评问题数量（battles总数）
    completed_battles: int  # 已完成的对战数量（winner不为NULL）
    daily_battles: List[DailyBattleItem]  # 近10天每天的作答数量


@router.get("/statistics", response_model=StatisticsResponse)
async def get_statistics(
    req: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    获取系统统计数据
    仅 admin 账号可以调用
    """
    current_user_id = get_current_user(req)
    if current_user_id != "admin":
        raise HTTPException(status_code=403, detail="只有 admin 可以查看统计数据")
    
    # 总用户数（排除admin）
    total_users_result = await db.execute(
        select(func.count(User.id)).where(User.id != "admin")
    )
    total_users = total_users_result.scalar() or 0
    
    # 当前作答人数（question_count > 0 的用户数，排除admin）
    active_users_result = await db.execute(
        select(func.count(distinct(User.id)))
        .where(User.id != "admin", User.question_count > 0)
    )
    active_users = active_users_result.scalar() or 0
    
    # 总测评问题数量（battles总数）
    total_battles_result = await db.execute(select(func.count(Battle.id)))
    total_battles = total_battles_result.scalar() or 0
    
    # 已完成的对战数量（winner不为NULL）
    completed_battles_result = await db.execute(
        select(func.count(Battle.id)).where(Battle.winner.isnot(None))
    )
    completed_battles = completed_battles_result.scalar() or 0
    
    # 近10天每天的作答数量
    ten_days_ago = datetime.now() - timedelta(days=10)
    
    # 使用DATE()函数（SQLAlchemy的func.date()同时支持MySQL和SQLite）
    daily_battles_result = await db.execute(
        select(
            func.date(Battle.created_at).label('date'),
            func.count(Battle.id).label('count')
        )
        .where(Battle.created_at >= ten_days_ago)
        .group_by(func.date(Battle.created_at))
        .order_by(func.date(Battle.created_at))
    )
    
    daily_battles_data = daily_battles_result.all()
    
    # 生成完整的10天数据（包括没有数据的日期）
    daily_battles_dict = {str(row.date): row.count for row in daily_battles_data}
    daily_battles = []
    for i in range(10):
        date = (datetime.now() - timedelta(days=9-i)).date()
        date_str = date.strftime('%Y-%m-%d')
        daily_battles.append(DailyBattleItem(
            date=date_str,
            count=daily_battles_dict.get(date_str, 0)
        ))
    
    return StatisticsResponse(
        total_users=total_users,
        active_users=active_users,
        total_battles=total_battles,
        completed_battles=completed_battles,
        daily_battles=daily_battles
    )

