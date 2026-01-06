# 数据表合并迁移指南

## 📋 概述

本次更新将 `battles` 和 `battle_evaluations` 两张表合并为一张新表 `battle_records`，简化数据库结构，提高查询效率。

## 🔄 变更说明

### 旧表结构
- **battles**: 存储对战基本信息（模型ID、对话历史、投票结果等）
- **battle_evaluations**: 存储测评维度数据（精准感知、合适口吻、坚持立场、有效引导）

### 新表结构
- **battle_records**: 合并表，包含所有对战信息和测评维度数据

### 字段映射

| 旧表字段 | 新表字段 | 说明 |
|---------|---------|------|
| battles.* | battle_records.* | 基本字段直接映射 |
| battle_evaluations (model_a) | model_a_perception, model_a_calibration, model_a_differentiation, model_a_regulation, model_a_rating | 模型A的测评数据 |
| battle_evaluations (model_b) | model_b_perception, model_b_calibration, model_b_differentiation, model_b_regulation, model_b_rating | 模型B的测评数据 |

## 🚀 迁移步骤

### 方式一：自动迁移（推荐）

应用启动时会自动检查并执行数据迁移：

```bash
python main.py
```

或

```bash
python run.py
```

### 方式二：手动迁移

使用提供的迁移脚本：

```bash
python migrate_to_battle_records.py
```

迁移脚本功能：
- ✅ 自动检查表是否存在
- ✅ 避免重复迁移
- ✅ 保持原有记录ID（确保外键关系不受影响）
- ✅ 批量提交（每100条）
- ✅ 详细的进度显示
- ✅ 迁移后数据验证

## ⚠️ 注意事项

1. **备份数据**
   ```bash
   # SQLite备份
   cp lmarena.db lmarena.db.backup
   
   # MySQL备份
   mysqldump -u root -p lmarena > lmarena_backup.sql
   ```

2. **外键关系**
   - `votes` 表的 `battle_id` 外键已更新为引用 `battle_records.id`
   - 迁移时保持相同的ID，确保现有投票记录不受影响

3. **旧表保留**
   - 迁移完成后，旧表（`battles` 和 `battle_evaluations`）会保留
   - 验证数据无误后，可手动删除：
     ```sql
     DROP TABLE battle_evaluations;
     DROP TABLE battles;
     ```

4. **兼容性**
   - 代码已全面更新为使用 `BattleRecord` 模型
   - 旧的 `Battle` 和 `BattleEvaluation` 模型保留但标记为已弃用

## 📊 数据验证

迁移完成后，验证数据：

```python
# 进入Python环境
python

# 执行验证
import asyncio
from models.database import async_session_maker
from models.schemas import Battle, BattleRecord
from sqlalchemy import select

async def verify():
    async with async_session_maker() as session:
        # 统计旧表
        battles = await session.execute(select(Battle))
        old_count = len(battles.scalars().all())
        
        # 统计新表
        records = await session.execute(select(BattleRecord))
        new_count = len(records.scalars().all())
        
        print(f"battles 表记录数: {old_count}")
        print(f"battle_records 表记录数: {new_count}")
        
        if old_count == new_count:
            print("✓ 数据迁移成功！")
        else:
            print(f"⚠ 警告: 记录数不匹配")

asyncio.run(verify())
```

## 🔍 常见问题

### Q: 迁移失败怎么办？
A: 
1. 检查数据库连接配置
2. 查看错误日志
3. 恢复备份后重新尝试
4. 联系技术支持

### Q: 旧表什么时候可以删除？
A:
1. 迁移成功完成
2. 应用运行正常
3. 数据验证通过
4. 完成数据备份

### Q: 是否影响现有功能？
A: 不影响。所有API已更新，功能完全兼容。

### Q: 性能有提升吗？
A: 有！合并表减少了JOIN查询，提高了查询效率。

## 📝 技术细节

### 合并逻辑

```python
# 对于每条 battle 记录
for battle in battles:
    # 查找对应的评测数据
    eval_a = find_evaluation(battle.id, "model_a")
    eval_b = find_evaluation(battle.id, "model_b")
    
    # 创建合并记录
    BattleRecord(
        # 基本信息来自 battles
        id=battle.id,
        model_a_id=battle.model_a_id,
        ...
        
        # 评测数据来自 battle_evaluations
        model_a_perception=eval_a.perception,
        model_a_calibration=eval_a.calibration,
        ...
    )
```

### 表结构对比

**旧结构（2张表）:**
```
battles (10 字段) + battle_evaluations (6 字段 × 2条记录)
= 需要JOIN查询
```

**新结构（1张表）:**
```
battle_records (18 字段)
= 单表查询，性能更优
```

## 🎯 优势

1. **简化查询**: 不再需要JOIN操作
2. **提高性能**: 减少数据库查询次数
3. **便于维护**: 单表管理更简单
4. **数据一致性**: 避免关联表的数据不一致问题
5. **扩展性强**: 后续添加字段更方便

## 📞 支持

如有问题，请参考：
- 项目文档：`README.md`
- 故障排除：`故障排除.md`
- 联系技术支持

