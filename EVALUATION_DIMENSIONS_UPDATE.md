# 评价维度更新说明

## 📋 更新概述

将原有的4个评价维度更新为5个教案核心评价维度，更适合教案质量评估场景。

## 🔄 维度变更对比

### 旧维度（4个）
1. **精准感知** (perception)
2. **合适口吻** (calibration)
3. **坚持立场** (differentiation)
4. **有效引导** (regulation)

### 新维度（5个）- 优质教案核心评价
1. **是否可执行** (executable)
   - 核心说明：评估教案在实际教学环境中（特别是农村课堂）能否被顺利、完整地实施
   - 重点考察：对现实条件的适应性、流程清晰度与弹性、对不同教师能力的包容性

2. **是否符合学情** (student_fit)
   - 核心说明：评估教案是否真正基于农村学生的实际生活经验、认知水平、家庭背景和心理需求进行设计
   - 重点考察：与学生熟悉的世界相连接、活动设计的有效参与性

3. **是否扎实有用** (practical)
   - 核心说明：评估教案是否聚焦于让学生真正掌握核心知识与技能，并能够迁移应用
   - 重点考察：教学目标务实性、练习反馈有效性、作业设计的减负增效

4. **是否融合本土** (local_integration)
   - 核心说明：评估教案是否自觉、巧妙地将本地的自然物产、文化传统、生产生活经验转化为教学资源
   - 重点考察：利用乡土特色深化学习体验、培育乡土情感与文化自信

5. **是否善用技术** (tech_use)
   - 核心说明：评估教案如何恰当地融合技术（包括AI工具）以提升教学效果
   - 重点考察：技术应用的目的性、适度性与可靠性

## 🗂️ 数据库字段更新

### BattleRecord 表字段

**模型 A 评价字段:**
- `model_a_executable` - 是否可执行
- `model_a_student_fit` - 是否符合学情
- `model_a_practical` - 是否扎实有用
- `model_a_local_integration` - 是否融合本土
- `model_a_tech_use` - 是否善用技术
- `model_a_rating` - 投票后评分（保持不变）

**模型 B 评价字段:**
- `model_b_executable` - 是否可执行
- `model_b_student_fit` - 是否符合学情
- `model_b_practical` - 是否扎实有用
- `model_b_local_integration` - 是否融合本土
- `model_b_tech_use` - 是否善用技术
- `model_b_rating` - 投票后评分（保持不变）

## 💻 代码更新范围

### 1. 数据库模型 (models/schemas.py)
- ✅ 更新 `BattleRecord` 类的字段定义
- ✅ 更新 `BattleEvaluation` 类（保留兼容性）

### 2. API 接口 (api/battle.py)
- ✅ 更新 `submit_evaluation` 函数的评测维度处理逻辑
- ✅ 更新注释说明新的5个维度

### 3. 前端界面 (static/js/app.js)
- ✅ 更新评测界面的HTML生成代码
- ✅ 修改 `evaluationData` 对象结构
- ✅ 更新 `checkAllDimensionsSelected` 函数

### 4. 数据迁移 (models/database.py)
- ✅ 更新 `migrate_to_battle_records` 函数
- ✅ 支持新旧字段的兼容性处理

## 🚀 使用指南

### 前端界面

用户在提交对话后，会看到5个评价维度：

```
教案评价维度：

1. 是否可执行
   [符合要求] [不符合要求]

2. 是否符合学情
   [符合要求] [不符合要求]

3. 是否扎实有用
   [符合要求] [不符合要求]

4. 是否融合本土
   [符合要求] [不符合要求]

5. 是否善用技术
   [符合要求] [不符合要求]
```

### API 调用示例

```javascript
// 提交评测维度
await fetch('/api/battle/evaluation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        session_id: "xxx",
        evaluation: {
            model_a: {
                executable: 1,        // 1=符合，0=不符合
                student_fit: 1,
                practical: 0,
                local_integration: 1,
                tech_use: 1
            },
            model_b: {
                executable: 0,
                student_fit: 1,
                practical: 1,
                local_integration: 0,
                tech_use: 1
            }
        }
    })
});
```

### 数据库查询示例

```sql
-- 查询某个对战的评价数据
SELECT 
    id,
    model_a_id,
    model_b_id,
    -- 模型 A 的评价
    model_a_executable,
    model_a_student_fit,
    model_a_practical,
    model_a_local_integration,
    model_a_tech_use,
    -- 模型 B 的评价
    model_b_executable,
    model_b_student_fit,
    model_b_practical,
    model_b_local_integration,
    model_b_tech_use
FROM battle_records
WHERE id = 'xxx';

-- 统计各维度的符合率
SELECT 
    '是否可执行' as dimension,
    AVG(model_a_executable) as model_a_rate,
    AVG(model_b_executable) as model_b_rate
FROM battle_records
WHERE model_a_executable IS NOT NULL

UNION ALL

SELECT 
    '是否符合学情',
    AVG(model_a_student_fit),
    AVG(model_b_student_fit)
FROM battle_records
WHERE model_a_student_fit IS NOT NULL

-- ... 其他维度类似
```

## 📊 数据分析

### 评价维度分析

```python
# Python 示例：分析各维度表现
import pandas as pd
from sqlalchemy import select
from models.schemas import BattleRecord

async def analyze_dimensions():
    async with async_session_maker() as session:
        result = await session.execute(select(BattleRecord))
        records = result.scalars().all()
        
        # 转换为 DataFrame
        data = []
        for r in records:
            data.append({
                'model_a_executable': r.model_a_executable,
                'model_a_student_fit': r.model_a_student_fit,
                'model_a_practical': r.model_a_practical,
                'model_a_local_integration': r.model_a_local_integration,
                'model_a_tech_use': r.model_a_tech_use,
                # ... model_b 同理
            })
        
        df = pd.DataFrame(data)
        
        # 计算各维度平均分
        dimensions = ['executable', 'student_fit', 'practical', 
                     'local_integration', 'tech_use']
        
        for dim in dimensions:
            model_a_avg = df[f'model_a_{dim}'].mean()
            model_b_avg = df[f'model_b_{dim}'].mean()
            print(f"{dim}: 模型A={model_a_avg:.2%}, 模型B={model_b_avg:.2%}")
```

## ⚠️ 注意事项

1. **向后兼容**: 旧的评测数据（4个维度）在迁移时会自动处理，新字段设为 NULL
2. **数据完整性**: 只有提交了评测的记录才会有维度数据，未提交的为 NULL
3. **前端验证**: 必须完成所有5个维度的评价才能提交
4. **评分影响**: 维度评价不影响模型排名，只用于数据分析

## 🔧 技术细节

### 字段类型
- 所有维度字段都是 `Integer` 类型
- 取值范围：`1` (符合要求) 或 `0` (不符合要求)
- 允许 `NULL` (未评价)

### 数据库迁移
- 启动应用时自动执行迁移
- 旧数据的4个维度字段不会迁移到新的5个维度
- 新旧表结构完全独立，互不影响

### 前端实现
- 使用按钮组选择评价（符合/不符合）
- 所有维度必须完成才能提交
- 提交后隐藏评测界面，显示投票选项

## 📞 问题反馈

如遇到问题，请检查：
1. 数据库表结构是否正确创建
2. 前端评测界面是否正常显示5个维度
3. API 提交是否成功保存数据
4. 控制台是否有错误信息

---

**更新日期**: 2026-01-06  
**版本**: v2.0  
**影响范围**: 数据库表结构、API接口、前端界面

