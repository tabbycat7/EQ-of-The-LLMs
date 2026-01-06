"""检查MySQL数据库表结构"""
import asyncio
import asyncmy

async def check_tables():
    """检查MySQL数据库中的表"""
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
            # 查看所有表
            await cursor.execute("SHOW TABLES")
            tables = await cursor.fetchall()
            
            print(f"\nFound {len(tables)} tables:")
            for table in tables:
                print(f"  - {table[0]}")
            
            # 检查 votes 表的结构
            if tables:
                print("\nChecking 'votes' table structure:")
                await cursor.execute("DESCRIBE votes")
                columns = await cursor.fetchall()
                for col in columns:
                    print(f"  {col[0]}: {col[1]}")
                
                # 检查外键约束
                print("\nChecking foreign keys for 'votes' table:")
                await cursor.execute("""
                    SELECT 
                        CONSTRAINT_NAME,
                        TABLE_NAME,
                        COLUMN_NAME,
                        REFERENCED_TABLE_NAME,
                        REFERENCED_COLUMN_NAME
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                    WHERE TABLE_SCHEMA = 'lmarena'
                    AND TABLE_NAME = 'votes'
                    AND REFERENCED_TABLE_NAME IS NOT NULL
                """)
                fks = await cursor.fetchall()
                for fk in fks:
                    print(f"  {fk[0]}: {fk[1]}.{fk[2]} -> {fk[3]}.{fk[4]}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    asyncio.run(check_tables())

