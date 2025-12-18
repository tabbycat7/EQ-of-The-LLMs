"""登录认证API"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import bcrypt

from models.database import get_db
from models.schemas import User

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

