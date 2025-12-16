"""检查 API 支持的模型列表"""
from openai import OpenAI
from dotenv import load_dotenv
import os
import sys

# 设置输出编码为 UTF-8
sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(override=True)

# 测试 OpenAI API
print("=" * 60)
print("[检查] OpenAI API 支持的模型")
print("=" * 60)
print(f"API Key: {os.getenv('OPENAI_API_KEY')[:20]}...")
print(f"Base URL: {os.getenv('OPENAI_BASE_URL')}")
print()

try:
    client = OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_BASE_URL")
    )
    
    # 获取模型列表
    models = client.models.list()
    
    print("[成功] 可用的模型：")
    print("-" * 60)
    for model in models.data:
        print(f"  - {model.id}")
    
except Exception as e:
    print(f"[失败] 获取模型列表失败: {str(e)}")
    print()
    print("[提示] 你的 API 提供商可能不支持 models.list() 接口")
    print("   请访问你的 API 提供商文档查看支持的模型列表")

print()
print("=" * 60)
print("[检查] DeepSeek API 支持的模型")
print("=" * 60)
print(f"API Key: {os.getenv('DEEPSEEK_API_KEY', 'Not Set')[:20]}...")
print(f"Base URL: {os.getenv('DEEPSEEK_BASE_URL')}")
print()

if os.getenv('DEEPSEEK_API_KEY'):
    try:
        ds_client = OpenAI(
            api_key=os.getenv("DEEPSEEK_API_KEY"),
            base_url=os.getenv("DEEPSEEK_BASE_URL")
        )
        
        # 获取模型列表
        models = ds_client.models.list()
        
        print("[成功] 可用的模型：")
        print("-" * 60)
        for model in models.data:
            print(f"  - {model.id}")
        
    except Exception as e:
        print(f"[失败] 获取模型列表失败: {str(e)}")
        print()
        print("[提示] DeepSeek 可能不支持 models.list() 接口")
        print("   建议直接使用: deepseek-chat, deepseek-reasoner")
else:
    print("[警告] DEEPSEEK_API_KEY 未配置")

print()
print("=" * 60)
print("💡 提示：")
print("   根据上面的输出，修改 config.py 中的 AVAILABLE_MODELS")
print("   只保留实际可用的模型")
print("=" * 60)

