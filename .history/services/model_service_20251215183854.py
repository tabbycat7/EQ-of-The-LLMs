"""模型调用服务"""
import asyncio
from typing import List, Dict, Optional
from openai import AsyncOpenAI
import config


class ModelService:
    """AI 模型调用服务"""
    
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=config.OPENAI_API_KEY,
            base_url=config.OPENAI_BASE_URL
        )
    
    async def get_completion(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> str:
        """
        获取模型回复
        
        Args:
            model_id: 模型 ID
            messages: 消息列表 [{"role": "user", "content": "..."}]
            temperature: 温度参数
            max_tokens: 最大 token 数
            
        Returns:
            模型的回复内容
        """
        try:
            response = await self.client.chat.completions.create(
                model=model_id,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"模型 {model_id} 调用失败: {str(e)}")
            return f"抱歉，模型调用失败: {str(e)}"
    
    async def get_dual_completion(
        self,
        model_a_id: str,
        model_b_id: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> tuple[str, str]:
        """
        同时获取两个模型的回复（用于对战模式）
        
        Args:
            model_a_id: 模型 A 的 ID
            model_b_id: 模型 B 的 ID
            messages: 消息列表
            temperature: 温度参数
            max_tokens: 最大 token 数
            
        Returns:
            (模型 A 的回复, 模型 B 的回复)
        """
        # 并行调用两个模型
        results = await asyncio.gather(
            self.get_completion(model_a_id, messages, temperature, max_tokens),
            self.get_completion(model_b_id, messages, temperature, max_tokens),
            return_exceptions=True
        )
        
        response_a = results[0] if not isinstance(results[0], Exception) else f"模型 A 调用失败: {str(results[0])}"
        response_b = results[1] if not isinstance(results[1], Exception) else f"模型 B 调用失败: {str(results[1])}"
        
        return response_a, response_b
    
    async def stream_completion(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000
    ):
        """
        流式获取模型回复（用于实时显示）
        
        Args:
            model_id: 模型 ID
            messages: 消息列表
            temperature: 温度参数
            max_tokens: 最大 token 数
            
        Yields:
            模型回复的文本片段
        """
        try:
            stream = await self.client.chat.completions.create(
                model=model_id,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            yield f"抱歉，模型调用失败: {str(e)}"
    
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

