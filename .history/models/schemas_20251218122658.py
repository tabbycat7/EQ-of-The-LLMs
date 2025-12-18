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
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), nullable=True)  # 用户ID（发起对战的用户）
    model_a_id = Column(String(100), nullable=False)  # 模型 A 的 ID
    model_b_id = Column(String(100), nullable=False)  # 模型 B 的 ID
    conversation = Column(JSON, default=list)  # 对话历史 [{"role": "user", "content": "..."}, ...]
    model_a_response = Column(Text)  # 模型 A 的最后回复
    model_b_response = Column(Text)  # 模型 B 的最后回复
    winner = Column(String(50), nullable=True)  # 胜者: "model_a", "model_b", "tie", None
    is_revealed = Column(Integer, default=0)  # 是否已揭示模型身份
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Vote(Base):
    """投票记录表"""
    __tablename__ = "votes"
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    battle_id = Column(String(50), ForeignKey("battles.id"), nullable=False)
    winner = Column(String(50), nullable=False)  # "model_a", "model_b", "tie"
    model_a_id = Column(String(100), nullable=False)  # 记录具体模型 ID
    model_b_id = Column(String(100), nullable=False)
    user_prompt = Column(Text)  # 用户的提问
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ModelRating(Base):
    """模型评分表"""
    __tablename__ = "model_ratings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    model_id = Column(String(100), unique=True, nullable=False)
    model_name = Column(String(200), nullable=False)
    rating = Column(Float, default=0)  # ELO 评分
    total_battles = Column(Integer, default=0)  # 总对战次数
    wins = Column(Integer, default=0)  # 胜利次数
    losses = Column(Integer, default=0)  # 失败次数
    ties = Column(Integer, default=0)  # 平局次数
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ChatSession(Base):
    """聊天会话表（用于 Side-by-Side 和 Direct 模式）"""
    __tablename__ = "chat_sessions"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), nullable=True)  # 用户ID（发起会话的用户）
    mode = Column(String(50), nullable=False)  # "direct" 或 "sidebyside"
    model_ids = Column(JSON, nullable=False)  # 使用的模型 ID 列表
    conversation = Column(JSON, default=list)  # 对话历史
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SideBySideVote(Base):
    """并排对比模式下的投票记录表"""
    __tablename__ = "sidebyside_votes"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    session_id = Column(String(50), ForeignKey("chat_sessions.id"), nullable=True)
    model_a_id = Column(String(100), nullable=False)
    model_b_id = Column(String(100), nullable=False)
    winner = Column(String(50), nullable=False)  # "model_a", "model_b", "tie"
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BattleEvaluation(Base):
    """对战测评维度记录表"""
    __tablename__ = "battle_evaluations"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    battle_id = Column(String(50), ForeignKey("battles.id"), nullable=False)
    model_type = Column(String(10), nullable=False)  # "model_a" 或 "model_b"
    model_id = Column(String(100), nullable=False)  # 模型 ID
    perception = Column(Integer, nullable=True)  # 感知：1=符合要求，0=不符合要求
    calibration = Column(Integer, nullable=True)  # 校准：1=符合要求，0=不符合要求
    differentiation = Column(Integer, nullable=True)  # 分化：1=符合要求，0=不符合要求
    regulation = Column(Integer, nullable=True)  # 调节：1=符合要求，0=不符合要求
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(String(50), primary_key=True)  # 用户ID（学号或admin）
    password_hash = Column(String(255), nullable=False)  # 密码哈希
    question_count = Column(Integer, default=0)  # 提问次数
    created_at = Column(DateTime(timezone=True), server_default=func.now())