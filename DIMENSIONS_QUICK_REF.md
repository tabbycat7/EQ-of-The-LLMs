# 评价维度快速对照表

## 新旧维度对比

| 序号 | 旧维度 | 新维度 | 字段名变化 |
|-----|-------|-------|-----------|
| 1 | 精准感知 | **是否可执行** | `perception` → `executable` |
| 2 | 合适口吻 | **是否符合学情** | `calibration` → `student_fit` |
| 3 | 坚持立场 | **是否扎实有用** | `differentiation` → `practical` |
| 4 | 有效引导 | **是否融合本土** | `regulation` → `local_integration` |
| 5 | - | **是否善用技术** | (新增) → `tech_use` |

## 评价标准

### 1. 是否可执行 (executable)
- ✅ **符合要求**: 教案流程清晰、可在农村课堂实施、适应不同教师能力
- ❌ **不符合要求**: 流程模糊、脱离实际条件、要求过高难以执行

### 2. 是否符合学情 (student_fit)  
- ✅ **符合要求**: 基于农村学生实际、与学生生活相连、全员有效参与
- ❌ **不符合要求**: 脱离学生认知水平、忽视留守儿童特点、难以引发共鸣

### 3. 是否扎实有用 (practical)
- ✅ **符合要求**: 聚焦核心知识技能、可迁移应用、练习反馈有效
- ❌ **不符合要求**: 目标空泛、只讲不练、学而无用

### 4. 是否融合本土 (local_integration)
- ✅ **符合要求**: 利用本地资源、融入乡土文化、培育乡土情感
- ❌ **不符合要求**: 脱离本土环境、照搬城市教案、忽视地方特色

### 5. 是否善用技术 (tech_use)
- ✅ **符合要求**: 技术应用恰当、服务教学目标、提升教学效果
- ❌ **不符合要求**: 为用而用、技术过度、脱离教学主线

## 数据库字段映射

### 完整字段列表

```
模型 A:
- model_a_executable          (是否可执行)
- model_a_student_fit         (是否符合学情)  
- model_a_practical           (是否扎实有用)
- model_a_local_integration   (是否融合本土)
- model_a_tech_use           (是否善用技术)
- model_a_rating             (评分)

模型 B:
- model_b_executable
- model_b_student_fit
- model_b_practical
- model_b_local_integration
- model_b_tech_use
- model_b_rating
```

## API 数据格式

```json
{
  "session_id": "xxx",
  "evaluation": {
    "model_a": {
      "executable": 1,          // 是否可执行
      "student_fit": 1,         // 是否符合学情
      "practical": 0,           // 是否扎实有用
      "local_integration": 1,   // 是否融合本土
      "tech_use": 1            // 是否善用技术
    },
    "model_b": {
      "executable": 0,
      "student_fit": 1,
      "practical": 1,
      "local_integration": 0,
      "tech_use": 1
    }
  }
}
```

## 前端标签文本

```html
<!-- 模型 A -->
<label>是否可执行</label>
<label>是否符合学情</label>
<label>是否扎实有用</label>
<label>是否融合本土</label>
<label>是否善用技术</label>

<!-- 每个维度有两个选项 -->
<button>符合要求</button>
<button>不符合要求</button>
```

## 评价流程

```
1. 用户提问
   ↓
2. 模型 A/B 回答
   ↓
3. 显示评价界面（5个维度）
   ↓
4. 用户选择每个维度（符合/不符合）
   ↓
5. 完成所有维度后，提交按钮启用
   ↓
6. 提交评测数据
   ↓
7. 显示投票选项
   ↓
8. 用户投票（A更好/B更好/都好/都不好）
```

## SQL 查询示例

```sql
-- 查看某条记录的完整评价
SELECT 
    model_a_id,
    model_a_executable as '模型A-可执行',
    model_a_student_fit as '模型A-符合学情',
    model_a_practical as '模型A-扎实有用',
    model_a_local_integration as '模型A-融合本土',
    model_a_tech_use as '模型A-善用技术',
    model_b_id,
    model_b_executable as '模型B-可执行',
    model_b_student_fit as '模型B-符合学情',
    model_b_practical as '模型B-扎实有用',
    model_b_local_integration as '模型B-融合本土',
    model_b_tech_use as '模型B-善用技术'
FROM battle_records
WHERE id = 'xxx';
```

