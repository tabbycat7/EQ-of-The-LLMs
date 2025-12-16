"""
LMArena 启动脚本
自动检查环境并启动应用
"""
import os
import sys
import subprocess
from pathlib import Path


def print_banner():
    """打印启动横幅"""
    banner = """
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║          🤖 LMArena - AI 模型对战评测平台            ║
║                                                       ║
║          欢迎使用 LMArena！                           ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
"""
    print(banner)


def check_python_version():
    """检查 Python 版本"""
    print("🔍 检查 Python 版本...")
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(f"❌ Python 版本过低: {version.major}.{version.minor}")
        print("   需要 Python 3.8 或更高版本")
        return False
    print(f"✅ Python 版本: {version.major}.{version.minor}.{version.micro}")
    return True


def check_dependencies():
    """检查依赖是否安装"""
    print("\n🔍 检查依赖包...")
    required_packages = [
        'fastapi',
        'uvicorn',
        'openai',
        'sqlalchemy',
        'aiosqlite',
        'pydantic',
        'python-dotenv'
    ]
    
    missing_packages = []
    for package in required_packages:
        try:
            # 一些包的 import 名称与安装名不同，这里做映射
            import_name_map = {
                'python-dotenv': 'dotenv',
            }
            import_name = import_name_map.get(package, package.replace('-', '_'))
            __import__(import_name)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} (未安装)")
            missing_packages.append(package)
    
    if missing_packages:
        print("\n⚠️  发现缺失的依赖包")
        print("请运行以下命令安装:")
        print(f"   pip install -r requirements.txt")
        return False
    
    return True


def check_env_file():
    """检查 .env 文件"""
    print("\n🔍 检查环境配置...")
    env_file = Path('.env')
    
    if not env_file.exists():
        print("❌ .env 文件不存在")
        print("   请从 .env.example 创建 .env 文件")
        print("   并填入你的 API Key")
        
        # 尝试复制 .env.example
        env_example = Path('.env.example')
        if env_example.exists():
            print("\n💡 提示: 可以运行以下命令:")
            if os.name == 'nt':  # Windows
                print("   copy .env.example .env")
            else:  # Linux/Mac
                print("   cp .env.example .env")
        return False
    
    print("✅ .env 文件存在")
    
    # 检查 API Key 是否配置
    with open('.env', 'r', encoding='utf-8') as f:
        content = f.read()
        if 'your_openai_api_key_here' in content or 'your-' in content:
            print("⚠️  请检查 .env 文件中的 API Key 是否正确配置")
            return False
    
    print("✅ API Key 已配置")
    return True


def check_directories():
    """检查必要的目录结构"""
    print("\n🔍 检查目录结构...")
    required_dirs = ['static/css', 'static/js', 'templates', 'models', 'services', 'api']
    
    for dir_path in required_dirs:
        if not Path(dir_path).exists():
            print(f"❌ 目录不存在: {dir_path}")
            return False
    
    print("✅ 目录结构完整")
    return True


def start_application():
    """启动应用"""
    print("\n🚀 启动 LMArena...")
    print("=" * 60)
    print("访问地址: http://localhost:8000")
    print("API 文档: http://localhost:8000/docs")
    print("按 Ctrl+C 停止服务器")
    print("=" * 60)
    print()
    
    try:
        # 使用 uvicorn 启动
        subprocess.run([
            sys.executable, '-m', 'uvicorn',
            'main:app',
            '--host', '0.0.0.0',
            '--port', '8000',
            '--reload'
        ])
    except KeyboardInterrupt:
        print("\n\n👋 应用已停止")
    except Exception as e:
        print(f"\n❌ 启动失败: {str(e)}")


def main():
    """主函数"""
    print_banner()
    
    # 执行所有检查
    checks = [
        ("Python 版本", check_python_version),
        ("依赖包", check_dependencies),
        ("环境配置", check_env_file),
        ("目录结构", check_directories),
    ]
    
    all_passed = True
    for name, check_func in checks:
        try:
            if not check_func():
                all_passed = False
                break
        except Exception as e:
            print(f"❌ {name}检查失败: {str(e)}")
            all_passed = False
            break
    
    if not all_passed:
        print("\n" + "=" * 60)
        print("❌ 环境检查未通过，请根据上述提示修复问题")
        print("=" * 60)
        print("\n💡 需要帮助？请查看:")
        print("   - START.md (快速启动指南)")
        print("   - 使用指南.md (详细文档)")
        print("   - README.md (项目说明)")
        return
    
    print("\n" + "=" * 60)
    print("✅ 所有检查通过！")
    print("=" * 60)
    
    # 启动应用
    start_application()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ 发生错误: {str(e)}")
        sys.exit(1)

