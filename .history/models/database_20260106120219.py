"""数据库连接和会话管理"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
import config

# 如果是 MySQL，添加字符集参数
database_url = config.DATABASE_URL
is_mysql = database_url.startswith("mysql+asyncmy://") or database_url.startswith("mysql://")

if is_mysql:
    # 确保连接字符串包含 charset=utf8mb4
    if "charset=" not in database_url and "?" not in database_url:
        database_url += "?charset=utf8mb4"
    elif "charset=" not in database_url:
        database_url += "&charset=utf8mb4"

# 配置连接参数
connect_args = {}
if is_mysql:
    # MySQL 连接参数（asyncmy 支持的参数）
    connect_args = {
        "charset": "utf8mb4",
    }

# 创建异步引擎，配置连接池
engine = create_async_engine(
    database_url,
    echo=False,
    future=True,
    # 连接池配置
    pool_size=10,  # 连接池大小
    max_overflow=20,  # 最大溢出连接数
    pool_timeout=30,  # 获取连接的超时时间（秒）
    pool_recycle=3600,  # 连接回收时间（秒）- 1小时，避免 MySQL wait_timeout 问题
    pool_pre_ping=True,  # 在每次使用前 ping 数据库，检查连接是否有效
    connect_args=connect_args
)

# 创建异步会话工厂
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# 创建基类
Base = declarative_base()


async def get_db():
    """获取数据库会话"""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """初始化数据库 - 创建全新的表结构"""
    print("初始化数据库...")
    
    # 只导入需要的表（新表结构）
    from .schemas import UserInfo, BattleRecord, Vote, ModelRating, ChatSession, SideBySideVote
    
    async with engine.begin() as conn:
        # 如果是 MySQL，先设置数据库和表的字符集
        if "mysql" in config.DATABASE_URL.lower():
            # 设置连接的字符集
            await conn.execute(text("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"))
            # 获取数据库名
            db_name = config.DATABASE_URL.split("/")[-1].split("?")[0]
            # 设置数据库字符集
            try:
                await conn.execute(text(f"ALTER DATABASE `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
            except Exception:
                pass  # 如果数据库不存在或已设置，忽略错误
        
        # 创建所有表（使用全新的表结构）
        await conn.run_sync(Base.metadata.create_all)
        
        # 如果是 MySQL，确保所有 TEXT 列使用 utf8mb4
        if "mysql" in config.DATABASE_URL.lower():
            try:
                await conn.execute(text("ALTER TABLE battle_records CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                await conn.execute(text("ALTER TABLE votes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                await conn.execute(text("ALTER TABLE model_ratings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                await conn.execute(text("ALTER TABLE chat_sessions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                await conn.execute(text("ALTER TABLE sidebyside_votes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                print("MySQL charset configured")
            except Exception as e:
                print(f"MySQL charset configuration skipped: {e}")
    
    print("数据库初始化完成！")
    
    # 初始化模型评分
    async with async_session_maker() as session:
        from sqlalchemy import select
        import pandas as pd
        import os
        
        # 检查是否已有模型评分数据
        result = await session.execute(select(ModelRating))
        existing_models = result.scalars().all()
        
        if not existing_models:
            # 初始化所有模型的评分
            for model_config in config.AVAILABLE_MODELS:
                model_rating = ModelRating(
                    model_id=model_config["id"],
                    model_name=model_config["name"],
                    rating=model_config.get("initial_rating", config.INITIAL_RATING),
                    total_battles=0,
                    wins=0,
                    losses=0,
                    ties=0
                )
                session.add(model_rating)
            
            await session.commit()
