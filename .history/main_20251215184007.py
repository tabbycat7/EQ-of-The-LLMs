"""LMArena 主应用入口"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from api import battle_router, chat_router, leaderboard_router
from models.database import init_db


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

# 挂载静态文件
app.mount("/static", StaticFiles(directory="static"), name="static")

# 配置模板
templates = Jinja2Templates(directory="templates")

# 注册 API 路由
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
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

