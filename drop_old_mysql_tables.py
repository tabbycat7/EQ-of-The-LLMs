"""删除MySQL中的旧表"""
import asyncio
import asyncmy

async def drop_old_tables():
    """删除旧的不再使用的表"""
    print("Connecting to MySQL database...")
    
    conn = await asyncmy.connect(
        host='localhost',
        port=3306,
        user='root',
        password='371619',
        database='lmarena'
    )
    
    try:
        async with conn.cursor() as cursor:
            # 删除旧表（按依赖顺序）
            old_tables = ['battle_evaluations', 'battles', 'users']
            
            for table in old_tables:
                try:
                    print(f"Dropping table: {table}...")
                    await cursor.execute(f"DROP TABLE IF EXISTS {table}")
                    print(f"  OK - {table} dropped")
                except Exception as e:
                    print(f"  Error dropping {table}: {e}")
            
            await conn.commit()
            print("\nOld tables removed successfully!")
            
            # 检查剩余的表
            await cursor.execute("SHOW TABLES")
            tables = await cursor.fetchall()
            print(f"\nRemaining tables ({len(tables)}):")
            for table in tables:
                print(f"  - {table[0]}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    asyncio.run(drop_old_tables())

