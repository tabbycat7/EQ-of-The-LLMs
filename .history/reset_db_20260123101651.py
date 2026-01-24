"""重置数据库脚本
使用此脚本可以完全删除并重新创建所有数据库表
"""
import asyncio
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 导入数据库初始化函数
from models.database import init_db


async def main():
    """重置数据库"""
    print("=" * 60)
    print("⚠️  警告：此操作将删除所有数据库表和数据！")
    print("=" * 60)
    
    # 确认操作
    confirm = input("确认要重置数据库吗？(输入 'yes' 确认): ")
    if confirm.lower() != 'yes':
        print("操作已取消")
        return
    
    print("\n开始重置数据库...")
    await init_db(reset_db=True)
    print("\n✅ 数据库重置完成！")


if __name__ == "__main__":
    asyncio.run(main())
