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
    """初始化数据库"""
    from .schemas import Battle, Vote, ModelRating, ChatSession, SideBySideVote, User, BattleEvaluation
    
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
        
        # 为battle_evaluations表添加model_id列（适用于所有数据库类型）
        try:
            await conn.execute(text("ALTER TABLE battle_evaluations ADD COLUMN model_id VARCHAR(100)"))
        except Exception:
            pass  # 列已存在，忽略错误
        
        # 为battle_evaluations表添加rating列（适用于所有数据库类型）
        try:
            # 对于不同的数据库类型，使用不同的语法
            database_url_str = str(engine.url)
            if "sqlite" in database_url_str:
                await conn.execute(text("ALTER TABLE battle_evaluations ADD COLUMN rating REAL"))
            else:
                await conn.execute(text("ALTER TABLE battle_evaluations ADD COLUMN rating FLOAT"))
        except Exception:
            pass  # 列已存在，忽略错误
        
        # 为battles表添加is_question_valid列（适用于所有数据库类型）
        try:
            await conn.execute(text("ALTER TABLE battles ADD COLUMN is_question_valid INTEGER"))
        except Exception:
            pass  # 列已存在，忽略错误
        
        # 为model_ratings表添加wins_valid列（适用于所有数据库类型）
        try:
            await conn.execute(text("ALTER TABLE model_ratings ADD COLUMN wins_valid INTEGER DEFAULT 0"))
        except Exception:
            pass  # 列已存在，忽略错误
        
        # 为model_ratings表添加tie_valid列（适用于所有数据库类型）
        try:
            await conn.execute(text("ALTER TABLE model_ratings ADD COLUMN tie_valid INTEGER DEFAULT 0"))
        except Exception:
            pass  # 列已存在，忽略错误
    
    # 初始化模型评分和用户数据
    async with async_session_maker() as session:
        from sqlalchemy import select
        import pandas as pd
        import os
        import bcrypt
        
        # 使用bcrypt直接加密，避免passlib的兼容性问题
        
        # 检查是否已有用户数据
        result = await session.execute(select(User))
        existing_users = result.scalars().all()
        existing_user_ids = {user.id for user in existing_users}
        
        # 从Excel文件读取用户并创建用户记录（即使已有用户，也要检查是否有新用户）
        user_file = "user.xlsx"
        if os.path.exists(user_file):
            try:
                df = pd.read_excel(user_file)
                # 获取uid列（如果存在），否则使用第一列
                if 'uid' in df.columns:
                    user_ids = df['uid'].dropna().tolist()
                elif len(df.columns) > 0:
                    # 如果uid列不存在，使用第一列
                    user_ids = df.iloc[:, 0].dropna().tolist()
                else:
                    print(f"警告: {user_file} 中没有找到有效的列")
                    user_ids = []
                
                new_users_count = 0
                for user_id_raw in user_ids:
                    try:
                        # 清理用户ID，确保是字符串且去除空白
                        user_id = str(user_id_raw).strip()
                        if not user_id or user_id.lower() == 'nan' or user_id in existing_user_ids:
                            continue
                        
                        # 设置密码：admin为123，其他为学号后四位
                        if user_id.lower() == "admin":
                            password_str = "123"
                        else:
                            # 取学号后四位
                            password_str = user_id[-4:] if len(user_id) >= 4 else user_id
                        
                        # 使用bcrypt直接加密密码
                        # bcrypt限制密码最长72字节，但用户密码（学号后四位或"123"）远小于此限制
                        password_bytes = password_str.encode('utf-8')
                        # 确保不超过72字节（虽然不太可能）
                        if len(password_bytes) > 72:
                            password_bytes = password_bytes[:72]
                        
                        # 使用bcrypt加密密码
                        salt = bcrypt.gensalt()
                        password_hash = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
                        
                        # 创建用户
                        user = User(
                            id=user_id,
                            password_hash=password_hash
                        )
                        session.add(user)
                        new_users_count += 1
                        existing_user_ids.add(user_id)
                    except Exception as user_error:
                        print(f"处理用户 {user_id_raw} 时出错: {user_error}")
                        continue
                
                if new_users_count > 0:
                    await session.commit()
                    print(f"已从 {user_file} 导入 {new_users_count} 个新用户")
                elif not existing_users:
                    print(f"从 {user_file} 未找到有效用户数据")
            except Exception as e:
                print(f"导入用户数据时出错: {e}")
                await session.rollback()
        
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

