"""
LMArena API 测试脚本
用于快速测试 API 端点是否正常工作
"""
import asyncio
import httpx


BASE_URL = "http://localhost:8000"


async def test_health():
    """测试健康检查"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health")
        print("✅ 健康检查:", response.json())
        return response.status_code == 200


async def test_get_models():
    """测试获取模型列表"""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/api/chat/models")
        data = response.json()
        print(f"✅ 可用模型数量: {len(data['models'])}")
        for model in data['models']:
            print(f"   - {model['name']} ({model['id']})")
        return response.status_code == 200


async def test_battle_flow():
    """测试完整的对战流程"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. 开始对战
        print("\n🎮 测试对战模式...")
        response = await client.post(f"{BASE_URL}/api/battle/start")
        data = response.json()
        session_id = data['session_id']
        print(f"✅ 对战会话创建: {session_id}")
        
        # 2. 发送消息
        print("📤 发送测试消息...")
        response = await client.post(
            f"{BASE_URL}/api/battle/chat",
            json={
                "session_id": session_id,
                "message": "你好，请用一句话介绍自己。"
            }
        )
        data = response.json()
        print(f"✅ 收到回复:")
        print(f"   模型 A: {data['response_a'][:50]}...")
        print(f"   模型 B: {data['response_b'][:50]}...")
        
        # 3. 投票
        print("🗳️  提交投票...")
        response = await client.post(
            f"{BASE_URL}/api/battle/vote",
            json={
                "session_id": session_id,
                "winner": "model_a"
            }
        )
        data = response.json()
        print(f"✅ 投票成功!")
        print(f"   模型 A: {data['model_a_name']} (评分: {data['new_rating_a']:.1f})")
        print(f"   模型 B: {data['model_b_name']} (评分: {data['new_rating_b']:.1f})")
        
        return response.status_code == 200


async def test_direct_chat():
    """测试直接对话"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        print("\n💬 测试直接对话模式...")
        response = await client.post(
            f"{BASE_URL}/api/chat/direct",
            json={
                "model_id": "gpt-3.5-turbo",
                "message": "你好！"
            }
        )
        data = response.json()
        print(f"✅ 收到回复: {data['response'][:50]}...")
        return response.status_code == 200


async def test_leaderboard():
    """测试排行榜"""
    async with httpx.AsyncClient() as client:
        print("\n🏆 测试排行榜...")
        response = await client.get(f"{BASE_URL}/api/leaderboard")
        data = response.json()
        print(f"✅ 排行榜加载成功 (共 {data['total_models']} 个模型)")
        
        if data['leaderboard']:
            print("\n排行榜前 3 名:")
            for i, item in enumerate(data['leaderboard'][:3], 1):
                print(f"   {i}. {item['model_name']}: {item['rating']:.1f} 分 "
                      f"({item['total_battles']} 场对战)")
        
        return response.status_code == 200


async def main():
    """运行所有测试"""
    print("=" * 60)
    print("LMArena API 测试")
    print("=" * 60)
    
    tests = [
        ("健康检查", test_health),
        ("获取模型列表", test_get_models),
        ("排行榜", test_leaderboard),
        ("直接对话", test_direct_chat),
        ("对战流程", test_battle_flow),
    ]
    
    results = []
    
    for name, test_func in tests:
        try:
            result = await test_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name} 测试失败: {str(e)}")
            results.append((name, False))
    
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{status} - {name}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！应用运行正常。")
    else:
        print("\n⚠️ 部分测试失败，请检查配置和 API Key。")


if __name__ == "__main__":
    print("请确保应用正在运行 (python main.py)")
    print("正在连接到:", BASE_URL)
    print()
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n测试被用户中断")
    except Exception as e:
        print(f"\n\n测试运行失败: {str(e)}")
        print("请确保:")
        print("1. 应用正在运行 (python main.py)")
        print("2. .env 文件配置正确")
        print("3. 网络连接正常")

