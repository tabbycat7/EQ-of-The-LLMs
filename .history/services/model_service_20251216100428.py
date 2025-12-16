"""模型调用服务"""
import asyncio
from typing import List, Dict, Optional
from openai import OpenAI
from starlette.concurrency import run_in_threadpool
import config


class ModelService:
    """AI 模型调用服务（使用同步 OpenAI 客户端，在后台线程执行，避免 httpx 兼容性问题）"""

    def __init__(self):
        # OpenAI 客户端（默认）
        self.openai_client = OpenAI(
            api_key=config.OPENAI_API_KEY,
            base_url=config.OPENAI_BASE_URL,
        )
        
        # DeepSeek 客户端
        self.deepseek_client = OpenAI(
            api_key=config.DEEPSEEK_API_KEY,
            base_url=config.DEEPSEEK_BASE_URL,
        )
    
    def _get_client_for_model(self, model_id: str) -> OpenAI:
        """根据模型 ID 返回对应的 API 客户端"""
        # 判断是否是 DeepSeek 模型
        if model_id.startswith("deepseek-") or model_id.startswith("deepseek/"):
            return self.deepseek_client
        
        # 默认使用 OpenAI 客户端
        return self.openai_client

    async def get_completion(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """
        获取模型回复（在后台线程中调用同步 OpenAI 客户端）
        根据模型 ID 自动选择对应的 API 客户端
        """
        # 根据模型 ID 选择客户端
        client = self._get_client_for_model(model_id)

        def _call() -> str:
            resp = client.chat.completions.create(
                model=model_id,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return resp.choices[0].message.content

        try:
            return await run_in_threadpool(_call)
        except Exception as e:
            print(f"模型 {model_id} 调用失败: {str(e)}")
            return f"抱歉，模型调用失败: {str(e)}"

    async def get_dual_completion(
        self,
        model_a_id: str,
        model_b_id: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> tuple[str, str]:
        """
        同时获取两个模型的回复（用于对战/对比模式）
        """
        results = await asyncio.gather(
            self.get_completion(model_a_id, messages, temperature, max_tokens),
            self.get_completion(model_b_id, messages, temperature, max_tokens),
            return_exceptions=True,
        )

        response_a = (
            results[0]
            if not isinstance(results[0], Exception)
            else f"模型 A 调用失败: {str(results[0])}"
        )
        response_b = (
            results[1]
            if not isinstance(results[1], Exception)
            else f"模型 B 调用失败: {str(results[1])}"
        )

        return response_a, response_b

    # 目前前端未用到流式输出，如需可再实现
    async def stream_completion(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ):
        """占位实现：当前未启用流式输出"""
        content = await self.get_completion(
            model_id=model_id,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        yield content

    @staticmethod
    def get_available_models() -> List[Dict]:
        """获取可用的模型列表"""
        return config.AVAILABLE_MODELS

    @staticmethod
    def get_model_info(model_id: str) -> Optional[Dict]:
        """获取指定模型的信息"""
        for model in config.AVAILABLE_MODELS:
            if model["id"] == model_id:
                return model
        return None
