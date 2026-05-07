from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    # Server Configuration
    PORT: int = 8000
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Database Configuration
    DATABASE_URL: str = "sqlite:///./vibeclip.db"
    DB_DEBUG: bool = Field(default=False, env="DB_DEBUG")

    # JWT Configuration
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Google OAuth Configuration
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None

    # X AI API Configuration
    XAI_API_KEY: Optional[str] = None
    XAI_API_URL: str = "https://api.x.ai/v1"
    XAI_MODEL: Optional[str] = None  # Must be set explicitly via environment variable
    X_ANALYSIS_PROVIDER: str = "mock"  # Options: "mock", "xai"

    # Short Drama / xAI text (Responses API); base URL falls back to XAI_API_URL when unset
    XAI_BASE_URL: Optional[str] = Field(default=None, env="XAI_BASE_URL")
    XAI_TEXT_MODEL: Optional[str] = Field(default=None, env="XAI_TEXT_MODEL")
    SHORT_DRAMA_XAI_TEXT_TIMEOUT_SECONDS: int = Field(default=180, env="SHORT_DRAMA_XAI_TEXT_TIMEOUT_SECONDS")
    SHORT_DRAMA_SEGMENT_DIRECTOR_MAX_OUTPUT_TOKENS: int = Field(
        default=16384, env="SHORT_DRAMA_SEGMENT_DIRECTOR_MAX_OUTPUT_TOKENS"
    )
    XAI_TIMEOUT_SECONDS: int = Field(default=60, env="XAI_TIMEOUT_SECONDS")
    XAI_MAX_RETRIES: int = Field(default=2, env="XAI_MAX_RETRIES")
    SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER: bool = Field(default=False, env="SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER")

    # X (Twitter) API Configuration
    X_BEARER_TOKEN: Optional[str] = None  # Bearer token for X API v2

    # Exa API Configuration
    EXA_API_KEY: Optional[str] = None  # API key for Exa.ai neural search

    # Tavily API Configuration
    TAVILY_API_KEY: Optional[str] = None
    TAVILY_API_URL: str = "https://api.tavily.com"

    # Scrape.do API Configuration
    SCRAPE_DO_API_TOKEN: Optional[str] = Field(default=None, env="SCRAPE_DO_API_TOKEN")

    # Bright Data Configuration (Shopee 1.0)
    BRIGHTDATA_API_KEY: Optional[str] = Field(default=None, env="BRIGHTDATA_API_KEY")
    BRIGHTDATA_CUSTOMER_ID: Optional[str] = Field(default=None, env="BRIGHTDATA_CUSTOMER_ID")
    BRIGHTDATA_SHOPEE_ZONE: Optional[str] = Field(default=None, env="BRIGHTDATA_SHOPEE_ZONE")
    BRIGHTDATA_TIKTOK_ZONE: Optional[str] = Field(default=None, env="BRIGHTDATA_TIKTOK_ZONE")
    BRIGHTDATA_LAZADA_ZONE: Optional[str] = Field(default=None, env="BRIGHTDATA_LAZADA_ZONE")
    BRIGHTDATA_TIMEOUT_SECONDS: int = Field(default=120, env="BRIGHTDATA_TIMEOUT_SECONDS")
    BRIGHTDATA_MAX_RETRIES: int = Field(default=2, env="BRIGHTDATA_MAX_RETRIES")
    BRIGHTDATA_MAX_POLLS: int = Field(default=25, env="BRIGHTDATA_MAX_POLLS")
    BRIGHTDATA_POLL_INTERVAL_SECONDS: float = Field(default=3.0, env="BRIGHTDATA_POLL_INTERVAL_SECONDS")

    # Backward compatibility for existing BrightData service usage
    BRIGHTDATA_ZONE: Optional[str] = Field(default=None, env="BRIGHTDATA_ZONE")

    # TikTok Shop page_data API（可选；占位符 {product_id}）
    TIKTOK_PAGE_DATA_API_TEMPLATE: Optional[str] = Field(default=None, env="TIKTOK_PAGE_DATA_API_TEMPLATE")

    # Banana.dev（Flux 等 GPU 推理部署）
    BANANA_API_KEY: Optional[str] = Field(default=None, env="BANANA_API_KEY")
    BANANA_MODEL_KEY: Optional[str] = Field(default=None, env="BANANA_MODEL_KEY")
    BANANA_API_URL: str = Field(default="https://api.banana.dev/", env="BANANA_API_URL")

    # Google Gemini（图片优化首选；文生图需使用支持 IMAGE 输出的模型 ID）
    GEMINI_API_KEY: Optional[str] = Field(default=None, env="GEMINI_API_KEY")
    GEMINI_API_URL: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta",
        env="GEMINI_API_URL",
    )
    # Short Drama / Gemini image：模型名以 short_drama.providers.gemini_image_client.effective_gemini_image_model() 为准
    GEMINI_IMAGE_MODEL: Optional[str] = Field(default=None, env="GEMINI_IMAGE_MODEL")
    GEMINI_BASE_URL: Optional[str] = Field(default=None, env="GEMINI_BASE_URL")
    GEMINI_TIMEOUT_SECONDS: int = Field(default=120, env="GEMINI_TIMEOUT_SECONDS")
    GEMINI_MAX_RETRIES: int = Field(default=2, env="GEMINI_MAX_RETRIES")
    # Short Drama asset images: xai | gemini | mock (SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER still forces mock)
    SHORT_DRAMA_IMAGE_PROVIDER: str = Field(default="xai", env="SHORT_DRAMA_IMAGE_PROVIDER")
    SHORT_DRAMA_XAI_IMAGE_MODEL: Optional[str] = Field(default=None, env="SHORT_DRAMA_XAI_IMAGE_MODEL")
    SHORT_DRAMA_IMAGE_RETURN_FORMAT: str = Field(default="url", env="SHORT_DRAMA_IMAGE_RETURN_FORMAT")
    SHORT_DRAMA_IMAGE_ASPECT_RATIO: Optional[str] = Field(default=None, env="SHORT_DRAMA_IMAGE_ASPECT_RATIO")
    SHORT_DRAMA_IMAGE_RESOLUTION: Optional[str] = Field(default=None, env="SHORT_DRAMA_IMAGE_RESOLUTION")
    SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER: bool = Field(default=False, env="SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER")
    SHORT_DRAMA_IMAGE_MAX_CONCURRENT: int = Field(default=1, env="SHORT_DRAMA_IMAGE_MAX_CONCURRENT")

    # Short Drama / xAI video (Grok Imagine Video) — REST submit + poll
    XAI_VIDEO_BASE_URL: str = Field(default="https://api.x.ai", env="XAI_VIDEO_BASE_URL")
    XAI_VIDEO_MODEL: Optional[str] = Field(default=None, env="XAI_VIDEO_MODEL")
    XAI_VIDEO_TIMEOUT_SECONDS: float = Field(default=120.0, env="XAI_VIDEO_TIMEOUT_SECONDS")
    XAI_VIDEO_POLL_INTERVAL_MS: int = Field(default=5000, env="XAI_VIDEO_POLL_INTERVAL_MS")
    XAI_VIDEO_POLL_TIMEOUT_SECONDS: float = Field(default=600.0, env="XAI_VIDEO_POLL_TIMEOUT_SECONDS")
    XAI_VIDEO_MAX_RETRIES: int = Field(default=2, env="XAI_VIDEO_MAX_RETRIES")
    SHORT_DRAMA_USE_MOCK_VIDEO_PROVIDER: bool = Field(default=True, env="SHORT_DRAMA_USE_MOCK_VIDEO_PROVIDER")
    SHORT_DRAMA_VIDEO_MAX_CONCURRENT: int = Field(default=1, env="SHORT_DRAMA_VIDEO_MAX_CONCURRENT")
    # Public origin for Short Drama /static URLs (API + xAI reference images). Priority: SHORT_DRAMA_PUBLIC_BASE_URL → PUBLIC_BASE_URL → legacy SHORT_DRAMA_PUBLIC_MEDIA_BASE_URL → localhost (dev).
    SHORT_DRAMA_PUBLIC_BASE_URL: Optional[str] = Field(default=None, env="SHORT_DRAMA_PUBLIC_BASE_URL")
    PUBLIC_BASE_URL: Optional[str] = Field(default=None, env="PUBLIC_BASE_URL")
    # Legacy alias; still honored if the two above are unset
    SHORT_DRAMA_PUBLIC_MEDIA_BASE_URL: Optional[str] = Field(default=None, env="SHORT_DRAMA_PUBLIC_MEDIA_BASE_URL")

    # Alibaba DashScope（Qwen 图片生成备选）
    DASHSCOPE_API_KEY: Optional[str] = Field(default=None, env="DASHSCOPE_API_KEY")

    # Redis Configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # Frontend / CORS (Vibe Clip)
    FRONTEND_ORIGIN: str = Field(default="http://localhost:5173", env="FRONTEND_ORIGIN")
    CORS_ORIGINS: str = Field(
        default=(
            "http://localhost:5173,http://127.0.0.1:5173,"
            "https://vibeclip.vercel.app,https://vibeclip.cn,https://www.vibeclip.cn"
        ),
        env="CORS_ORIGINS",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"  # Ignore undefined environment variables (e.g., VITE_*)
    )


settings = Settings()
