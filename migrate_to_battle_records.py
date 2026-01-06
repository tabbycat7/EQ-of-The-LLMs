#!/usr/bin/env python3
"""
数据迁移脚本：将 battles 和 battle_evaluations 表的数据合并到 battle_records 表

使用方法:
    python migrate_to_battle_records.py

注意:
    - 此脚本会自动检查是否已有数据，避免重复迁移
    - 迁移过程中保持原有的 ID，确保 votes 表的外键关系不受影响
    - 迁移完成后，旧表（battles 和 battle_evaluations）仍保留，可手动删除
"""

import asyncio
import sys
from sqlalchemy import select, text
from models.database import async_session_maker, engine
from models.schemas import Battle, BattleEvaluation, BattleRecord


async def check_tables_exist():
    """检查旧表是否存在"""
    async with engine.begin() as conn:
        # 检查 battles 表
        try:
            await conn.execute(text("SELECT 1 FROM battles LIMIT 1"))
            battles_exist = True
        except Exception:
            battles_exist = False
        
        # 检查 battle_evaluations 表
        try:
            await conn.execute(text("SELECT 1 FROM battle_evaluations LIMIT 1"))
            evaluations_exist = True
        except Exception:
            evaluations_exist = False
        
        # 检查 battle_records 表
        try:
            await conn.execute(text("SELECT 1 FROM battle_records LIMIT 1"))
            records_exist = True
        except Exception:
            records_exist = False
    
    return battles_exist, evaluations_exist, records_exist


async def migrate_data():
    """执行数据迁移"""
    print("=" * 60)
    print("开始数据迁移: battles + battle_evaluations → battle_records")
    print("=" * 60)
    
    # 检查表是否存在
    battles_exist, evaluations_exist, records_exist = await check_tables_exist()
    
    if not battles_exist:
        print("❌ 错误: battles 表不存在，无法迁移")
        return False
    
    if not records_exist:
        print("❌ 错误: battle_records 表不存在，请先运行应用初始化数据库")
        return False
    
    print(f"✓ 发现 battles 表")
    if evaluations_exist:
        print(f"✓ 发现 battle_evaluations 表")
    else:
        print(f"⚠ 警告: battle_evaluations 表不存在，将跳过评测维度数据")
    print(f"✓ 发现 battle_records 表")
    print()
    
    async with async_session_maker() as session:
        try:
            # 检查新表是否已有数据
            result = await session.execute(select(BattleRecord))
            existing_records = result.scalars().all()
            
            if existing_records:
                print(f"⚠ battle_records 表已有 {len(existing_records)} 条记录")
                response = input("是否继续迁移（可能导致数据重复）? [y/N]: ")
                if response.lower() != 'y':
                    print("取消迁移")
                    return False
                print()
            
            # 查询所有旧的 battle 记录
            battles_result = await session.execute(select(Battle))
            battles = battles_result.scalars().all()
            
            if not battles:
                print("✓ 没有需要迁移的数据")
                return True
            
            print(f"📊 找到 {len(battles)} 条 battle 记录需要迁移")
            print()
            
            migrated_count = 0
            skipped_count = 0
            error_count = 0
            
            for i, battle in enumerate(battles, 1):
                try:
                    # 检查该记录是否已经迁移
                    existing = await session.execute(
                        select(BattleRecord).where(BattleRecord.id == battle.id)
                    )
                    if existing.scalar_one_or_none():
                        print(f"[{i}/{len(battles)}] 跳过已存在记录: {battle.id}")
                        skipped_count += 1
                        continue
                    
                    # 查询该 battle 的评测维度数据
                    model_a_eval = None
                    model_b_eval = None
                    
                    if evaluations_exist:
                        eval_result = await session.execute(
                            select(BattleEvaluation).where(
                                BattleEvaluation.battle_id == battle.id
                            )
                        )
                        evaluations = eval_result.scalars().all()
                        
                        # 将评测数据按模型类型分组
                        for eval in evaluations:
                            if eval.model_type == "model_a":
                                model_a_eval = eval
                            elif eval.model_type == "model_b":
                                model_b_eval = eval
                    
                    # 创建新的 BattleRecord
                    new_record = BattleRecord(
                        id=battle.id,  # 保持相同的 ID，确保 votes 表外键不受影响
                        user_id=battle.user_id,
                        model_a_id=battle.model_a_id,
                        model_b_id=battle.model_b_id,
                        conversation=battle.conversation,
                        model_a_response=battle.model_a_response,
                        model_b_response=battle.model_b_response,
                        winner=battle.winner,
                        is_revealed=battle.is_revealed,
                        is_question_valid=battle.is_question_valid,
                        # 模型 A 的测评维度
                        model_a_perception=model_a_eval.perception if model_a_eval else None,
                        model_a_calibration=model_a_eval.calibration if model_a_eval else None,
                        model_a_differentiation=model_a_eval.differentiation if model_a_eval else None,
                        model_a_regulation=model_a_eval.regulation if model_a_eval else None,
                        model_a_rating=model_a_eval.rating if model_a_eval else None,
                        # 模型 B 的测评维度
                        model_b_perception=model_b_eval.perception if model_b_eval else None,
                        model_b_calibration=model_b_eval.calibration if model_b_eval else None,
                        model_b_differentiation=model_b_eval.differentiation if model_b_eval else None,
                        model_b_regulation=model_b_eval.regulation if model_b_eval else None,
                        model_b_rating=model_b_eval.rating if model_b_eval else None,
                        created_at=battle.created_at,
                        updated_at=battle.updated_at
                    )
                    session.add(new_record)
                    
                    # 每100条提交一次
                    if i % 100 == 0:
                        await session.commit()
                        print(f"[{i}/{len(battles)}] 已迁移 {i} 条记录...")
                    
                    migrated_count += 1
                    
                except Exception as e:
                    print(f"❌ 迁移记录 {battle.id} 时出错: {e}")
                    error_count += 1
                    await session.rollback()
                    continue
            
            # 提交剩余的记录
            await session.commit()
            
            print()
            print("=" * 60)
            print("迁移完成！")
            print("=" * 60)
            print(f"✓ 成功迁移: {migrated_count} 条")
            if skipped_count > 0:
                print(f"⊘ 已跳过: {skipped_count} 条 (已存在)")
            if error_count > 0:
                print(f"❌ 失败: {error_count} 条")
            print()
            
            if error_count == 0:
                print("🎉 所有数据迁移成功！")
                print()
                print("📝 后续步骤:")
                print("   1. 验证 battle_records 表的数据是否正确")
                print("   2. 确认应用运行正常")
                print("   3. (可选) 备份旧表后删除:")
                print("      - DROP TABLE battle_evaluations;")
                print("      - DROP TABLE battles;")
            
            return error_count == 0
            
        except Exception as e:
            print(f"❌ 数据迁移过程中出错: {e}")
            await session.rollback()
            return False


async def verify_migration():
    """验证迁移结果"""
    print()
    print("=" * 60)
    print("验证迁移结果")
    print("=" * 60)
    
    async with async_session_maker() as session:
        try:
            # 统计旧表数据
            battles_result = await session.execute(select(Battle))
            battles_count = len(battles_result.scalars().all())
            
            # 统计新表数据
            records_result = await session.execute(select(BattleRecord))
            records_count = len(records_result.scalars().all())
            
            print(f"battles 表记录数: {battles_count}")
            print(f"battle_records 表记录数: {records_count}")
            print()
            
            if battles_count == records_count:
                print("✓ 记录数量匹配！")
                return True
            else:
                print(f"⚠ 警告: 记录数量不匹配 (差异: {abs(battles_count - records_count)})")
                return False
                
        except Exception as e:
            print(f"❌ 验证过程中出错: {e}")
            return False


async def main():
    """主函数"""
    try:
        # 执行迁移
        success = await migrate_data()
        
        if success:
            # 验证结果
            await verify_migration()
            sys.exit(0)
        else:
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n⚠ 用户中断操作")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

