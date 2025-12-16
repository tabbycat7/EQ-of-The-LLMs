# 🎮 LMArena 功能演示

## 快速体验指南

本文档将带你快速体验 LMArena 的所有核心功能。

---

## 前置准备

1. ✅ 已安装依赖: `pip install -r requirements.txt`
2. ✅ 已配置 `.env` 文件，填入有效的 OpenAI API Key
3. ✅ 应用已启动: `python run.py` 或 `python main.py`

---

## 演示场景

### 场景 1: 匿名对战 - 比较代码能力 ⚔️

**目标**: 测试不同模型的代码编写能力

**步骤**:
1. 打开浏览器访问 http://localhost:8000
2. 确认在"匿名对战"模式（默认）
3. 点击"开始对战"按钮
4. 输入测试问题：
   ```
   请用 Python 实现一个二分查找算法，要求：
   1. 支持升序数组
   2. 返回目标值的索引
   3. 如果不存在返回 -1
   4. 包含注释说明
   ```
5. 查看两个模型的回答
6. 根据以下标准投票：
   - 代码正确性
   - 注释质量
   - 代码风格
   - 边界情况处理
7. 投票后查看模型身份和评分变化

**预期结果**:
- 两个模型同时给出答案
- 可以清晰对比代码质量差异
- 投票后揭示是 GPT-4 vs GPT-3.5-turbo 等
- ELO 评分实时更新

---

### 场景 2: 匿名对战 - 比较创意能力 🎨

**目标**: 测试模型的创造性思维

**步骤**:
1. 开始新对战
2. 输入创意问题：
   ```
   请为一家太空旅游公司设计一句有创意的广告语，
   要求：简短、易记、能体现冒险精神
   ```
3. 对比两个模型的创意
4. 选择更有创意的答案

**评价维度**:
- 创意性
- 记忆点
- 品牌契合度
- 情感共鸣

---

### 场景 3: 并排对比 - 深度分析 📊

**目标**: 详细对比特定模型的差异

**步骤**:
1. 切换到"并排对比"模式
2. 选择模型 A: GPT-4 Turbo
3. 选择模型 B: GPT-3.5 Turbo
4. 输入复杂问题：
   ```
   请详细解释量子计算的基本原理，包括：
   1. 量子比特的概念
   2. 叠加态和纠缠
   3. 与经典计算的区别
   4. 主要应用领域
   
   要求用通俗易懂的语言，适合非专业人士理解
   ```
5. 仔细对比两个回答的：
   - 内容深度
   - 解释清晰度
   - 例子质量
   - 结构组织

**观察要点**:
- GPT-4 通常更详细、更准确
- GPT-3.5 可能更简洁但不够深入
- 注意专业术语的解释差异

---

### 场景 4: 直接对话 - 多轮交互 💬

**目标**: 测试模型的上下文理解能力

**步骤**:
1. 切换到"直接对话"模式
2. 选择 GPT-4
3. 进行多轮对话：

   **第 1 轮**:
   ```
   我想学习 Python，但我是完全的编程新手。
   你能给我一个学习路线吗？
   ```

   **第 2 轮**:
   ```
   关于你提到的第一步，能给个具体的代码示例吗？
   ```

   **第 3 轮**:
   ```
   如果我在这个代码中遇到错误怎么办？
   ```

4. 观察模型是否能：
   - 记住之前的对话内容
   - 根据上下文给出相关回答
   - 保持话题连贯性

---

### 场景 5: 排行榜 - 查看统计 🏆

**目标**: 查看基于真实投票的模型排名

**步骤**:
1. 切换到"排行榜"模式
2. 查看各项指标：
   - **排名**: 基于 ELO 评分
   - **评分**: 数值越高越强
   - **对战数**: 参与的总次数
   - **胜率**: 胜利百分比
   - **战绩**: 胜/负/平详细数据

3. 分析排行榜：
   - 哪个模型最强？
   - 评分差距有多大？
   - 对战数量是否足够有参考价值？

4. 点击"刷新排行榜"查看最新数据

---

## 高级测试场景

### 场景 6: 压力测试模型差异

**测试领域**:

1. **数学能力**
   ```
   解方程组：
   2x + 3y = 13
   5x - y = 7
   请给出详细的解题步骤
   ```

2. **逻辑推理**
   ```
   有三个人：A总是说真话，B总是说谎，C有时说真话有时说谎。
   A说："B是说谎的人"
   B说："C有时说真话"
   请推理出谁是谁？
   ```

3. **代码调试**
   ```
   以下 Python 代码有什么问题？如何修复？
   
   def calculate_average(numbers):
       sum = 0
       for num in numbers:
           sum += num
       return sum / len(numbers)
   
   result = calculate_average([])
   print(result)
   ```

4. **文本创作**
   ```
   以"时间机器"为主题，写一个100字左右的科幻微小说
   ```

5. **多语言能力**
   ```
   将以下句子翻译成英文、日文、法文：
   "人工智能正在改变世界"
   并解释各语言的语法特点
   ```

---

### 场景 7: API 测试（开发者向）

使用 Python 测试 API：

```python
import requests
import json

BASE_URL = "http://localhost:8000"

# 1. 获取模型列表
models = requests.get(f"{BASE_URL}/api/chat/models").json()
print("可用模型:", [m['name'] for m in models['models']])

# 2. 开始对战
battle = requests.post(f"{BASE_URL}/api/battle/start").json()
session_id = battle['session_id']
print(f"对战开始: {session_id}")

# 3. 发送消息
chat_response = requests.post(
    f"{BASE_URL}/api/battle/chat",
    json={
        "session_id": session_id,
        "message": "用一句话介绍人工智能"
    }
).json()

print("\n模型 A 回答:", chat_response['response_a'])
print("\n模型 B 回答:", chat_response['response_b'])

# 4. 投票
vote_response = requests.post(
    f"{BASE_URL}/api/battle/vote",
    json={
        "session_id": session_id,
        "winner": "model_a"
    }
).json()

print(f"\n揭示身份:")
print(f"  模型 A: {vote_response['model_a_name']} (新评分: {vote_response['new_rating_a']:.1f})")
print(f"  模型 B: {vote_response['model_b_name']} (新评分: {vote_response['new_rating_b']:.1f})")

# 5. 查看排行榜
leaderboard = requests.get(f"{BASE_URL}/api/leaderboard").json()
print("\n排行榜:")
for item in leaderboard['leaderboard'][:3]:
    print(f"  {item['rank']}. {item['model_name']}: {item['rating']:.1f} 分")
```

---

## 数据分析示例

### 导出数据进行分析

```python
import sqlite3
import pandas as pd

# 连接数据库
conn = sqlite3.connect('lmarena.db')

# 1. 查看投票分布
votes_df = pd.read_sql_query("""
    SELECT model_a_id, model_b_id, winner, COUNT(*) as count
    FROM votes
    GROUP BY model_a_id, model_b_id, winner
""", conn)
print(votes_df)

# 2. 查看模型评分历史
ratings_df = pd.read_sql_query("""
    SELECT model_name, rating, total_battles, wins, losses, ties
    FROM model_ratings
    ORDER BY rating DESC
""", conn)
print(ratings_df)

# 3. 计算胜率
ratings_df['win_rate'] = (ratings_df['wins'] / ratings_df['total_battles'] * 100).round(1)
print(ratings_df[['model_name', 'rating', 'win_rate']])

conn.close()
```

---

## 性能基准测试

### 响应时间测试

```python
import time
import requests

def test_response_time():
    start_time = time.time()
    
    # 开始对战
    session = requests.post("http://localhost:8000/api/battle/start").json()
    
    # 发送消息并等待响应
    response = requests.post(
        "http://localhost:8000/api/battle/chat",
        json={
            "session_id": session['session_id'],
            "message": "1+1等于几？"
        }
    ).json()
    
    end_time = time.time()
    elapsed = end_time - start_time
    
    print(f"总耗时: {elapsed:.2f} 秒")
    return elapsed

# 运行 5 次取平均值
times = [test_response_time() for _ in range(5)]
print(f"\n平均响应时间: {sum(times)/len(times):.2f} 秒")
```

---

## 预期结果总结

完成以上所有演示后，你应该能够：

✅ 理解匿名对战如何减少偏见  
✅ 掌握不同模式的使用场景  
✅ 了解 ELO 评分系统的工作原理  
✅ 能够评估不同模型的优劣  
✅ 可以通过 API 集成到其他应用  
✅ 理解如何收集和分析模型对比数据  

---

## 下一步建议

### 扩展应用场景

1. **教育领域**: 让学生对比不同模型的答案质量
2. **内容创作**: 测试模型的写作风格差异
3. **代码助手**: 评估编程辅助能力
4. **客服场景**: 对比客户问题回答质量
5. **多语言翻译**: 测试翻译准确度

### 数据收集计划

- 每周至少进行 50 场对战
- 覆盖多个领域（技术、创意、逻辑等）
- 邀请不同背景的用户参与投票
- 定期分析评分趋势

### 持续改进

- 根据使用反馈调整 UI
- 添加更多模型对比
- 优化评分算法参数
- 增加数据可视化功能

---

**开始你的 AI 模型对战之旅吧！** 🚀🤖

