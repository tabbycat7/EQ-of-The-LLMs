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
        max_tokens: int = 8000,
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
        max_tokens: int = 8000,
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

    async def stream_completion(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 8000,
    ):
        """
        流式获取模型回复
        根据模型 ID 自动选择对应的 API 客户端
        """
        # 根据模型 ID 选择客户端
        client = self._get_client_for_model(model_id)

        def _stream():
            try:
                stream = client.chat.completions.create(
                    model=model_id,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True,
                )
                for chunk in stream:
                    if chunk.choices and len(chunk.choices) > 0:
                        delta = chunk.choices[0].delta
                        if delta and delta.content is not None:
                            yield delta.content
            except Exception as e:
                yield f"抱歉，模型调用失败: {str(e)}"

        # 使用 asyncio.Queue 来桥接同步流和异步生成器
        # 注意：asyncio.Queue 可以在线程中使用 put_nowait
        q = asyncio.Queue(maxsize=1000)  # 设置较大的队列大小避免阻塞
        
        def _run_stream():
            try:
                for chunk in _stream():
                    # put_nowait 是同步的，可以在线程中使用
                    try:
                        q.put_nowait(("chunk", chunk))
                    except Exception:
                        # 如果队列满（很少见），跳过这个 chunk
                        pass
                q.put_nowait(("done", None))
            except Exception as e:
                try:
                    q.put_nowait(("error", str(e)))
                except:
                    pass
        
        # 在后台线程中运行同步流
        import threading
        thread = threading.Thread(target=_run_stream, daemon=True)
        thread.start()
        
        # 异步读取队列，立即 yield，无延迟
        while True:
            try:
                # 直接 await，不设置超时，立即获取数据
                event_type, data = await q.get()
                if event_type == "chunk":
                    yield data
                elif event_type == "done":
                    break
                elif event_type == "error":
                    yield f"抱歉，模型调用失败: {data}"
                    break
            except Exception as e:
                # 检查线程是否还在运行
                if not thread.is_alive():
                    break
                await asyncio.sleep(0.001)
                continue

    async def stream_dual_completion(
        self,
        model_a_id: str,
        model_b_id: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 8000,
    ):
        """
        同时流式获取两个模型的回复（用于对战/对比模式）
        返回一个异步生成器，每次 yield (model: str, chunk: str)
        model 为 "a" 或 "b"
        """
        # 创建两个流式任务
        stream_a = self.stream_completion(model_a_id, messages, temperature, max_tokens)
        stream_b = self.stream_completion(model_b_id, messages, temperature, max_tokens)
        
        # 使用 asyncio.Queue 来合并两个流
        queue = asyncio.Queue()
        
        async def collect_stream(stream, model_label: str):
            try:
                async for chunk in stream:
                    await queue.put((model_label, chunk))
            except Exception as e:
                await queue.put((model_label, f"错误: {str(e)}"))
            finally:
                await queue.put((model_label, None))  # 结束标记
        
        # 启动两个收集任务
        task_a = asyncio.create_task(collect_stream(stream_a, "a"))
        task_b = asyncio.create_task(collect_stream(stream_b, "b"))
        
        # 等待两个任务完成
        completed = {"a": False, "b": False}
        
        while not (completed["a"] and completed["b"]):
            model_label, chunk = await queue.get()
            if chunk is None:
                completed[model_label] = True
            else:
                yield (model_label, chunk)

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
