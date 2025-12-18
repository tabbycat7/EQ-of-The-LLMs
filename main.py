"""LMArena 主应用入口"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager
import os
import secrets

from api import battle_router, chat_router, leaderboard_router
from api.auth import router as auth_router
from models.database import init_db

# 使用环境变量或生成固定的secret key用于session
SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "lmarena-session-secret-key-change-in-production")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化数据库
    print("初始化数据库...")
    await init_db()
    print("数据库初始化完成！")
    yield
    # 关闭时的清理工作
    print("应用关闭")


# 创建 FastAPI 应用
app = FastAPI(
    title="LMArena - AI 模型对战评测平台",
    description="一个开源的 AI 模型体验与评测平台",
    version="1.0.0",
    lifespan=lifespan
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 配置 Session 中间件（需要在CORS之后，因为需要处理cookies）
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET_KEY,
    max_age=86400 * 30,  # 30天
    same_site="lax"
)

# 挂载静态文件
app.mount("/static", StaticFiles(directory="static"), name="static")

# 配置模板
templates = Jinja2Templates(directory="templates")

# 注册 API 路由
app.include_router(auth_router)
app.include_router(battle_router)
app.include_router(chat_router)
app.include_router(leaderboard_router)


@app.get("/")
async def index(request: Request):
    """首页"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "message": "LMArena is running!"}


if __name__ == "__main__":
    import os
    import uvicorn
    
    # 支持云平台部署：使用环境变量 PORT，默认 8000
    port = int(os.getenv("PORT", 8000))
    # 生产环境使用 0.0.0.0 以允许外部访问
    host = os.getenv("HOST", "127.0.0.1")
    # 生产环境关闭 reload
    reload = os.getenv("ENV", "development") == "development"
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload
    )

