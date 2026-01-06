"""数据库表结构定义"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from .database import Base
import uuid


def generate_uuid():
    """生成 UUID"""
    return str(uuid.uuid4())


class UserInfo(Base):
    """用户信息表（记录用户基本信息）"""
    __tablename__ = "user_info"
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    region = Column(String(100), nullable=False)  # 地区
    school = Column(String(200), nullable=False)  # 学校
    subject = Column(String(100), nullable=False)  # 学科
    grade = Column(String(50), nullable=False)  # 授课年级
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BattleRecord(Base):
    """对战记录表（合并 battles 和 battle_evaluations）"""
    __tablename__ = "battle_records"
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), nullable=True)  # 用户ID（发起对战的用户）
    
    # 模型信息
    model_a_id = Column(String(100), nullable=False)  # 模型 A 的 ID
    model_b_id = Column(String(100), nullable=False)  # 模型 B 的 ID
    
    # 对话内容
    conversation = Column(JSON, default=list)  # 对话历史 [{"role": "user", "content": "..."}, ...]
    model_a_response = Column(Text)  # 模型 A 的最后回复
    model_b_response = Column(Text)  # 模型 B 的最后回复
    
    # 投票结果
    winner = Column(String(50), nullable=True)  # 胜者: "model_a", "model_b", "tie", "both_bad", None
    is_revealed = Column(Integer, default=0)  # 是否已揭示模型身份
    is_question_valid = Column(Integer, nullable=True)  # 问题是否符合要求：1=符合，0=不符合，NULL=未标记
    
    # 模型 A 的测评维度（教案评价 - 5点李克特量表）
    model_a_executable = Column(Integer, nullable=True)  # 可执行性：1-5分（1=非常不可行，5=非常可行）
    model_a_student_fit = Column(Integer, nullable=True)  # 符合学情：1-5分（1=非常不符合，5=非常符合）
    model_a_practical = Column(Integer, nullable=True)  # 扎实有用：1-5分（1=非常不实用，5=非常实用）
    model_a_local_integration = Column(Integer, nullable=True)  # 融合本土：1-5分（1=完全未融合，5=融合很好）
    model_a_tech_use = Column(Integer, nullable=True)  # 善用技术：1-5分（1=完全未使用，5=使用很好）
    model_a_rating = Column(Float, nullable=True)  # 投票后模型 A 的 rating 值
    
    # 模型 B 的测评维度（教案评价 - 5点李克特量表）
    model_b_executable = Column(Integer, nullable=True)  # 可执行性：1-5分（1=非常不可行，5=非常可行）
    model_b_student_fit = Column(Integer, nullable=True)  # 符合学情：1-5分（1=非常不符合，5=非常符合）
    model_b_practical = Column(Integer, nullable=True)  # 扎实有用：1-5分（1=非常不实用，5=非常实用）
    model_b_local_integration = Column(Integer, nullable=True)  # 融合本土：1-5分（1=完全未融合，5=融合很好）
    model_b_tech_use = Column(Integer, nullable=True)  # 善用技术：1-5分（1=完全未使用，5=使用很好）
    model_b_rating = Column(Float, nullable=True)  # 投票后模型 B 的 rating 值
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# 保留旧表定义以便兼容
class Battle(Base):
    """对战会话表（已弃用，保留用于数据迁移）"""
    __tablename__ = "battles"
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    user_id = Column(String(50), nullable=True)
    model_a_id = Column(String(100), nullable=False)
    model_b_id = Column(String(100), nullable=False)
    conversation = Column(JSON, default=list)
    model_a_response = Column(Text)
    model_b_response = Column(Text)
    winner = Column(String(50), nullable=True)
    is_revealed = Column(Integer, default=0)
    is_question_valid = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Vote(Base):
    """投票记录表"""
    __tablename__ = "votes"
    
    id = Column(String(50), primary_key=True, default=generate_uuid)
    battle_id = Column(String(50), ForeignKey("battle_records.id"), nullable=False)  # 引用新表
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
    """对战测评维度记录表（已弃用，保留用于数据迁移）"""
    __tablename__ = "battle_evaluations"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    battle_id = Column(String(50), ForeignKey("battles.id"), nullable=False)
    model_type = Column(String(10), nullable=False)
    model_id = Column(String(100), nullable=False)
    # 旧字段（已弃用）
    perception = Column(Integer, nullable=True)
    calibration = Column(Integer, nullable=True)
    differentiation = Column(Integer, nullable=True)
    regulation = Column(Integer, nullable=True)
    # 新字段（教案评价）
    executable = Column(Integer, nullable=True)
    student_fit = Column(Integer, nullable=True)
    practical = Column(Integer, nullable=True)
    local_integration = Column(Integer, nullable=True)
    tech_use = Column(Integer, nullable=True)
    rating = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(String(50), primary_key=True)  # 用户ID（学号或admin）
    password_hash = Column(String(255), nullable=False)  # 密码哈希
    question_count = Column(Integer, default=0)  # 提问次数
    created_at = Column(DateTime(timezone=True), server_default=func.now())