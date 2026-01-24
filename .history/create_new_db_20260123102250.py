"""创建新数据库脚本
此脚本会创建一个全新的数据库（MySQL）或使用新的数据库文件（SQLite）
"""
import asyncio
import os
import re
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# 加载环境变量
load_dotenv()

import config
from models.database import Base
from models.schemas import ModelRating
from sqlalchemy import select


async def create_new_database():
    """创建新数据库"""
    database_url = config.DATABASE_URL
    is_mysql = database_url.startswith("mysql+asyncmy://") or database_url.startswith("mysql://")
    
    if is_mysql:
        # MySQL: 创建新数据库
        print("=" * 60)
        print("创建新的 MySQL 数据库")
        print("=" * 60)
        
        # 从连接字符串中提取信息
        # 格式: mysql+asyncmy://user:password@host:port/dbname?charset=utf8mb4
        url_pattern = r"(mysql\+?asyncmy?://[^/]+)/([^?]+)(\?.*)?"
        match = re.match(url_pattern, database_url)
        
        if not match:
            print("❌ 无法解析数据库连接字符串")
            print(f"   当前 DATABASE_URL: {database_url}")
            return
        
        base_url = match.group(1)  # mysql+asyncmy://user:password@host:port
        old_db_name = match.group(2)  # 当前数据库名
        query_params = match.group(3) or ""  # 查询参数（如 ?charset=utf8mb4）
        
        # 获取新数据库名
        new_db_name = input(f"\n当前数据库名: {old_db_name}\n请输入新数据库名（直接回车使用默认 'lmarena_new'）: ").strip()
        if not new_db_name:
            new_db_name = "lmarena_new"
        
        print(f"\n正在创建新数据库: {new_db_name}...")
        
        try:
            # 创建临时引擎（不指定数据库，连接到 MySQL 服务器）
            temp_engine = create_async_engine(
                f"{base_url}{query_params}",
                echo=False,
                future=True
            )
            
            async with temp_engine.begin() as conn:
                # 创建新数据库
                await conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{new_db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                print(f"✅ 数据库 '{new_db_name}' 创建成功")
            
            await temp_engine.dispose()
            
            # 更新 .env 文件
            print(f"\n更新 .env 文件中的 DATABASE_URL...")
            env_file = ".env"
            new_database_url = f"{base_url}/{new_db_name}{query_params}"
            
            if os.path.exists(env_file):
                with open(env_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                updated = False
                new_lines = []
                for line in lines:
                    if line.strip().startswith('DATABASE_URL='):
                        new_lines.append(f"DATABASE_URL={new_database_url}\n")
                        updated = True
                    else:
                        new_lines.append(line)
                
                # 如果没有找到 DATABASE_URL，添加一行
                if not updated:
                    new_lines.append(f"DATABASE_URL={new_database_url}\n")
                
                with open(env_file, 'w', encoding='utf-8') as f:
                    f.writelines(new_lines)
                
                print(f"✅ .env 文件已更新")
                print(f"\n新的数据库连接字符串:")
                print(f"   DATABASE_URL={new_database_url}")
            else:
                print("⚠️  未找到 .env 文件")
                print(f"   请手动在 .env 文件中设置:")
                print(f"   DATABASE_URL={new_database_url}")
            
            # 初始化新数据库（使用新的连接字符串）
            print(f"\n正在初始化新数据库...")
            
            # 创建新引擎
            new_engine = create_async_engine(
                new_database_url,
                echo=False,
                future=True,
                pool_pre_ping=True
            )
            
            # 创建新会话工厂
            new_session_maker = async_sessionmaker(
                new_engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            # 创建所有表
            async with new_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            
            # 初始化模型评分数据
            async with new_session_maker() as session:
                result = await session.execute(select(ModelRating))
                existing_models = result.scalars().all()
                
                if not existing_models:
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
            
            await new_engine.dispose()
            print(f"✅ 新数据库初始化完成！")
            
        except Exception as e:
            print(f"❌ 创建数据库时出错: {e}")
            import traceback
            traceback.print_exc()
    
    else:
        # SQLite: 使用新的数据库文件
        print("=" * 60)
        print("创建新的 SQLite 数据库")
        print("=" * 60)
        
        # 提取当前数据库文件路径
        old_db_path = database_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
        if old_db_path.startswith("./"):
            old_db_path = old_db_path[2:]
        
        new_db_name = input(f"\n当前数据库文件: {old_db_path}\n请输入新数据库文件名（直接回车使用默认 'lmarena_new.db'）: ").strip()
        if not new_db_name:
            new_db_name = "lmarena_new.db"
        
        if not new_db_name.endswith('.db'):
            new_db_name += '.db'
        
        print(f"\n正在创建新数据库文件: {new_db_name}...")
        
        # 更新 .env 文件
        env_file = ".env"
        new_database_url = f"sqlite+aiosqlite:///./{new_db_name}"
        
        if os.path.exists(env_file):
            with open(env_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            updated = False
            new_lines = []
            for line in lines:
                if line.strip().startswith('DATABASE_URL='):
                    new_lines.append(f"DATABASE_URL={new_database_url}\n")
                    updated = True
                else:
                    new_lines.append(line)
            
            # 如果没有找到 DATABASE_URL，添加一行
            if not updated:
                new_lines.append(f"DATABASE_URL={new_database_url}\n")
            
            with open(env_file, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            
            print(f"✅ .env 文件已更新")
            print(f"\n新的数据库连接字符串:")
            print(f"   DATABASE_URL={new_database_url}")
        else:
            print("⚠️  未找到 .env 文件")
            print(f"   请手动在 .env 文件中设置:")
            print(f"   DATABASE_URL={new_database_url}")
        
        # 初始化新数据库
        print(f"\n正在初始化新数据库...")
        
        # 创建新引擎
        new_engine = create_async_engine(
            new_database_url,
            echo=False,
            future=True,
            pool_pre_ping=True
        )
        
        # 创建新会话工厂
        new_session_maker = async_sessionmaker(
            new_engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
        
        # 创建所有表
        async with new_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # 初始化模型评分数据
        async with new_session_maker() as session:
            result = await session.execute(select(ModelRating))
            existing_models = result.scalars().all()
            
            if not existing_models:
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
        
        await new_engine.dispose()
        print(f"✅ 新数据库初始化完成！")


async def main():
    """主函数"""
    await create_new_database()
    print("\n" + "=" * 60)
    print("✅ 新数据库创建完成！")
    print("=" * 60)
    print("\n提示：")
    print("1. .env 文件已更新，请重启应用以使用新数据库")
    print("2. 旧数据库的数据不会受到影响")
    print("3. 新数据库是完全干净的，只包含表结构")


if __name__ == "__main__":
    asyncio.run(main())
