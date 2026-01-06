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
    from .schemas import BattleRecord, Vote, ModelRating, ChatSession, SideBySideVote
    
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
                print("✓ MySQL字符集配置完成")
            except Exception as e:
                print(f"⊘ MySQL字符集配置跳过: {e}")
    
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


async def migrate_to_battle_records():
    """将旧的 battles 和 battle_evaluations 表的数据迁移到新的 battle_records 表"""
    async with async_session_maker() as session:
        from sqlalchemy import select
        from .schemas import Battle, BattleEvaluation, BattleRecord
        
        try:
            # 检查新表是否已有数据
            result = await session.execute(select(BattleRecord))
            existing_records = result.scalars().all()
            
            if existing_records:
                print("battle_records table already has data, skip migration")
                return
            
            # 查询所有旧的 battle 记录
            battles_result = await session.execute(select(Battle))
            battles = battles_result.scalars().all()
            
            if not battles:
                print("No battle data to migrate")
                return
            
            print(f"Start migrating {len(battles)} battle records...")
            
            for battle in battles:
                # 查询该 battle 的评测维度数据
                eval_result = await session.execute(
                    select(BattleEvaluation).where(BattleEvaluation.battle_id == battle.id)
                )
                evaluations = eval_result.scalars().all()
                
                # 将评测数据按模型类型分组
                model_a_eval = None
                model_b_eval = None
                for eval in evaluations:
                    if eval.model_type == "model_a":
                        model_a_eval = eval
                    elif eval.model_type == "model_b":
                        model_b_eval = eval
                
                # 创建新的 BattleRecord
                new_record = BattleRecord(
                    id=battle.id,  # 保持相同的 ID
                    user_id=battle.user_id,
                    model_a_id=battle.model_a_id,
                    model_b_id=battle.model_b_id,
                    conversation=battle.conversation,
                    model_a_response=battle.model_a_response,
                    model_b_response=battle.model_b_response,
                    winner=battle.winner,
                    is_revealed=battle.is_revealed,
                    is_question_valid=battle.is_question_valid,
                    # 模型 A 的测评维度（新字段）
                    model_a_executable=model_a_eval.executable if (model_a_eval and hasattr(model_a_eval, 'executable')) else None,
                    model_a_student_fit=model_a_eval.student_fit if (model_a_eval and hasattr(model_a_eval, 'student_fit')) else None,
                    model_a_practical=model_a_eval.practical if (model_a_eval and hasattr(model_a_eval, 'practical')) else None,
                    model_a_local_integration=model_a_eval.local_integration if (model_a_eval and hasattr(model_a_eval, 'local_integration')) else None,
                    model_a_tech_use=model_a_eval.tech_use if (model_a_eval and hasattr(model_a_eval, 'tech_use')) else None,
                    model_a_rating=model_a_eval.rating if model_a_eval else None,
                    # 模型 B 的测评维度（新字段）
                    model_b_executable=model_b_eval.executable if (model_b_eval and hasattr(model_b_eval, 'executable')) else None,
                    model_b_student_fit=model_b_eval.student_fit if (model_b_eval and hasattr(model_b_eval, 'student_fit')) else None,
                    model_b_practical=model_b_eval.practical if (model_b_eval and hasattr(model_b_eval, 'practical')) else None,
                    model_b_local_integration=model_b_eval.local_integration if (model_b_eval and hasattr(model_b_eval, 'local_integration')) else None,
                    model_b_tech_use=model_b_eval.tech_use if (model_b_eval and hasattr(model_b_eval, 'tech_use')) else None,
                    model_b_rating=model_b_eval.rating if model_b_eval else None,
                    created_at=battle.created_at,
                    updated_at=battle.updated_at
                )
                session.add(new_record)
            
            await session.commit()
            print(f"Successfully migrated {len(battles)} records to battle_records table")
            
        except Exception as e:
            print(f"Error during data migration: {e}")
            await session.rollback()

