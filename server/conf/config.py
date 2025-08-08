from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Dict, Any
import logging
import logging.config


class Settings(BaseSettings):
    APP_NAME: str = "AI Recruiter Assistant"
    DEBUG: bool = Field(default=False)
    ENVIRONMENT: str = Field(default="production")

    # Security
    SECRET_KEY: str
    CORS_ORIGINS: str = "*"

    # Database



    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str 
    POSTGRES_PORT: str 
    POSTGRES_DB: str 

    @property
    def DATABASE_URL(self):
        return f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


    FIREBASE_KEY_PATH: str = "./serviceAccountKey.json"

    # AI Services
    GEMINI_API_KEY: str
    MIN_MATCH_SCORE: int = 50

    # Email Service
    SENDGRID_API_KEY: str
    EMAIL_FROM: str = "recruiter@yourdomain.com"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # File Storage
    UPLOAD_DIR: str = "uploads"
    ALLOWED_FILE_TYPES: List[str] = Field(default_factory=lambda: ["pdf", "docx"])
    MAX_FILE_SIZE: int = 5242880  # 5MB

    # Logging Configuration
    LOGGING_CONFIG: Dict[str, Any] = {}

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "allow"  



settings = Settings()

# Set up logging config after settings are loaded
settings.LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S"
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "level": "DEBUG" if settings.DEBUG else "INFO",
        },
    },
    "loggers": {
        "": {
            "handlers": ["console"],
            "level": "DEBUG" if settings.DEBUG else "INFO",
            "propagate": True
        },
        "uvicorn.error": {
            "level": "INFO",
            "propagate": False
        },
    }
}

logging.config.dictConfig(settings.LOGGING_CONFIG)
logger = logging.getLogger(__name__)
