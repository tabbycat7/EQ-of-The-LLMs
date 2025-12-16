"""数据库连接和会话管理"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import config

# 创建异步引擎
engine = create_async_engine(
    config.DATABASE_URL,
    echo=False,
    future=True
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
    """初始化数据库"""
    from .schemas import Battle, Vote, ModelRating, ChatSession
    
    async with engine.begin() as conn:
        # 创建所有表
        await conn.run_sync(Base.metadata.create_all)
    
    # 初始化模型评分
    async with async_session_maker() as session:
        from sqlalchemy import select
        
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

