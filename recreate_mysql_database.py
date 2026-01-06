"""
MySQL数据库重建脚本
用于删除旧数据库并创建全新的数据库
"""
import asyncio
import asyncmy

async def recreate_database():
    """删除并重新创建MySQL数据库"""
    print("开始重建MySQL数据库...")
    
    # 连接到MySQL服务器（不指定数据库）
    conn = await asyncmy.connect(
        host='localhost',
        port=3306,
        user='root',
        password='371619'
    )
    
    try:
        async with conn.cursor() as cursor:
            # 删除旧数据库
            print("删除旧数据库 lmarena...")
            await cursor.execute("DROP DATABASE IF EXISTS lmarena")
            
            # 创建新数据库
            print("创建新数据库 lmarena...")
            await cursor.execute("CREATE DATABASE lmarena CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            
        await conn.commit()
        print("Database recreated successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    asyncio.run(recreate_database())

