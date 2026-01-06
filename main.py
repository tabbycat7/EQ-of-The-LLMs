"""LMArena 主应用入口"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import os
import logging

from api import battle_router, chat_router, leaderboard_router, user_router
from models.database import init_db

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


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
app.include_router(user_router)


# 全局异常处理器
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """处理 HTTP 异常"""
    logger.warning(f"HTTP异常: {exc.status_code} - {exc.detail} - 路径: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """处理请求验证异常"""
    logger.warning(f"请求验证失败: {exc.errors()} - 路径: {request.url.path}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """处理所有未捕获的异常"""
    logger.error(f"未处理的异常: {str(exc)} - 路径: {request.url.path}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"服务器内部错误: {str(exc)}"}
    )


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

