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


async def init_db(reset_db: bool = False):
    """初始化数据库
    
    Args:
        reset_db: 如果为 True，将删除所有表并重新创建（危险操作，会丢失所有数据）
    """
    from .schemas import Battle, Vote, ModelRating, ChatSession, SideBySideVote
    
    async with engine.begin() as conn:
        # 如果需要重置数据库，先删除所有表
        if reset_db:
            print("⚠️  警告：正在删除所有表并重新创建数据库...")
            if "mysql" in config.DATABASE_URL.lower():
                # MySQL: 先删除所有外键约束，然后删除表
                try:
                    # 获取所有表名
                    result = await conn.execute(text("SHOW TABLES"))
                    tables = [row[0] for row in result.fetchall()]
                    
                    # 禁用外键检查
                    await conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
                    
                    # 删除所有表
                    for table in tables:
                        try:
                            await conn.execute(text(f"DROP TABLE IF EXISTS `{table}`"))
                            print(f"  已删除表: {table}")
                        except Exception as e:
                            print(f"  删除表 {table} 时出错: {e}")
                    
                    # 重新启用外键检查
                    await conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                    print("✅ 所有表已删除")
                except Exception as e:
                    print(f"⚠️  删除表时出错: {e}")
            else:
                # SQLite: 直接删除所有表
                try:
                    result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
                    tables = [row[0] for row in result.fetchall()]
                    for table in tables:
                        if table != 'sqlite_sequence':  # 跳过 SQLite 系统表
                            try:
                                await conn.execute(text(f"DROP TABLE IF EXISTS `{table}`"))
                                print(f"  已删除表: {table}")
                            except Exception as e:
                                print(f"  删除表 {table} 时出错: {e}")
                    print("✅ 所有表已删除")
                except Exception as e:
                    print(f"⚠️  删除表时出错: {e}")
        
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
        
        # 创建所有表
        await conn.run_sync(Base.metadata.create_all)
        
        # 如果是 MySQL，确保所有 TEXT 列使用 utf8mb4
        if "mysql" in config.DATABASE_URL.lower():
            try:
                await conn.execute(text("ALTER TABLE battles CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                await conn.execute(text("ALTER TABLE votes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                await conn.execute(text("ALTER TABLE model_ratings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                await conn.execute(text("ALTER TABLE chat_sessions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                await conn.execute(text("ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
            except Exception:
                pass  # 如果表不存在或已设置，忽略错误
        
        # 为users表添加question_count列（适用于所有数据库类型）
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN question_count INTEGER DEFAULT 0"))
        except Exception:
            pass  # 列已存在，忽略错误
        
        # 为battles表添加user_id列（适用于所有数据库类型）
        try:
            await conn.execute(text("ALTER TABLE battles ADD COLUMN user_id VARCHAR(50)"))
        except Exception:
            pass  # 列已存在，忽略错误
        
        # 为chat_sessions表添加user_id列（适用于所有数据库类型）
        try:
            await conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN user_id VARCHAR(50)"))
        except Exception:
            pass  # 列已存在，忽略错误
        
        # 为battles表添加is_question_valid列（适用于所有数据库类型）
        try:
            await conn.execute(text("ALTER TABLE battles ADD COLUMN is_question_valid INTEGER"))
        except Exception:
            pass  # 列已存在，忽略错误
        
    
    # 初始化模型评分数据
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

