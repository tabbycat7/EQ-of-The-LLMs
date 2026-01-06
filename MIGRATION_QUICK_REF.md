# 表合并快速参考

## 一键迁移

```bash
# 方法1：启动应用（自动迁移）
python run.py

# 方法2：手动迁移脚本
python migrate_to_battle_records.py
```

## 表结构变化

### 旧表（已弃用）
- `battles` - 对战基本信息
- `battle_evaluations` - 测评维度（每个battle有2条记录）

### 新表
- `battle_records` - 合并所有信息到一张表

## 新表字段

```python
# 基本信息（来自 battles）
id, user_id, model_a_id, model_b_id
conversation, model_a_response, model_b_response
winner, is_revealed, is_question_valid
created_at, updated_at

# 模型A测评维度（来自 battle_evaluations）
model_a_perception        # 精准感知
model_a_calibration       # 合适口吻  
model_a_differentiation   # 坚持立场
model_a_regulation        # 有效引导
model_a_rating           # 投票后评分

# 模型B测评维度（来自 battle_evaluations）
model_b_perception, model_b_calibration
model_b_differentiation, model_b_regulation
model_b_rating
```

## 代码变更

### 导入变更
```python
# 旧代码
from models.schemas import Battle, BattleEvaluation

# 新代码
from models.schemas import BattleRecord
```

### 查询变更
```python
# 旧代码
battle = await db.execute(select(Battle).where(...))
eval = await db.execute(select(BattleEvaluation).where(...))

# 新代码
battle = await db.execute(select(BattleRecord).where(...))
# 测评数据直接在 battle 对象中
perception = battle.model_a_perception
```

### 创建记录
```python
# 旧代码
battle = Battle(...)
db.add(battle)
await db.commit()

eval_a = BattleEvaluation(battle_id=battle.id, model_type="model_a", ...)
eval_b = BattleEvaluation(battle_id=battle.id, model_type="model_b", ...)
db.add(eval_a)
db.add(eval_b)

# 新代码
battle = BattleRecord(
    ...,
    model_a_perception=1,
    model_a_calibration=0,
    model_b_perception=1,
    ...
)
db.add(battle)
```

## 清理旧表（可选）

```sql
-- 确认数据迁移成功后执行
DROP TABLE battle_evaluations;
DROP TABLE battles;
```

## 验证迁移

```bash
# 检查记录数
sqlite3 lmarena.db "SELECT COUNT(*) FROM battles;"
sqlite3 lmarena.db "SELECT COUNT(*) FROM battle_records;"

# 应该相等
```

