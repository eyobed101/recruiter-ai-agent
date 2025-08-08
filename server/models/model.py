from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ApplicationStatus(str, Enum):
    pending = "pending"
    viewed = "viewed"
    accepted = "accepted"
    rejected = "rejected"


class User(SQLModel, table=True):
    id: str = Field(primary_key=True)
    email: str = Field(unique=True, nullable=False, index=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)



class CareerCategory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)

    careers: List["CareerPost"] = Relationship(back_populates="category")


class CareerPost(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: str
    requirements: str
    location: str
    content: str = Field(default="")
    posted_at: datetime = Field(default_factory=datetime.utcnow)
    category_id: Optional[int] = Field(default=None, foreign_key="careercategory.id")

    category: Optional[CareerCategory] = Relationship(back_populates="careers")
    applications: List["Application"] = Relationship(back_populates="career")


class Application(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    full_name: str
    phone_number: str
    email: str
    cv_path: str
    document_path: Optional[str] = Field(default=None) 
    status: ApplicationStatus = Field(default=ApplicationStatus.pending)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    career_id: int = Field(foreign_key="careerpost.id")
    user_id: str = Field(nullable=False)  # Changed from Optional to required

    career: CareerPost = Relationship(back_populates="applications")

    # Add composite unique constraint
    __table_args__ = (
        UniqueConstraint('user_id', 'career_id', name='uix_user_career'),
    )
