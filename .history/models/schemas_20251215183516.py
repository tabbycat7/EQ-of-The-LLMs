"""数据库表结构定义"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from .database import Base
import uuid


def generate_uuid():
    """生成 UUID"""
    return str(uuid.uuid4())


class Battle(Base):
    """对战会话表"""
    __tablename__ = "battles"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    model_a_id = Column(String, nullable=False)  # 模型 A 的 ID
    model_b_id = Column(String, nullable=False)  # 模型 B 的 ID
    conversation = Column(JSON, default=list)  # 对话历史 [{"role": "user", "content": "..."}, ...]
    model_a_response = Column(Text)  # 模型 A 的最后回复
    model_b_response = Column(Text)  # 模型 B 的最后回复
    winner = Column(String, nullable=True)  # 胜者: "model_a", "model_b", "tie", None
    is_revealed = Column(Integer, default=0)  # 是否已揭示模型身份
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Vote(Base):
    """投票记录表"""
    __tablename__ = "votes"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    battle_id = Column(String, ForeignKey("battles.id"), nullable=False)
    winner = Column(String, nullable=False)  # "model_a", "model_b", "tie"
    model_a_id = Column(String, nullable=False)  # 记录具体模型 ID
    model_b_id = Column(String, nullable=False)
    user_prompt = Column(Text)  # 用户的提问
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ModelRating(Base):
    """模型评分表"""
    __tablename__ = "model_ratings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    model_id = Column(String, unique=True, nullable=False)
    model_name = Column(String, nullable=False)
    rating = Column(Float, default=1500.0)  # ELO 评分
    total_battles = Column(Integer, default=0)  # 总对战次数
    wins = Column(Integer, default=0)  # 胜利次数
    losses = Column(Integer, default=0)  # 失败次数
    ties = Column(Integer, default=0)  # 平局次数
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ChatSession(Base):
    """聊天会话表（用于 Side-by-Side 和 Direct 模式）"""
    __tablename__ = "chat_sessions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    mode = Column(String, nullable=False)  # "direct" 或 "sidebyside"
    model_ids = Column(JSON, nullable=False)  # 使用的模型 ID 列表
    conversation = Column(JSON, default=list)  # 对话历史
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

