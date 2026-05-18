from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    # Server Configuration
    PORT: int = 8000
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Deploy / integration (Aliyun prep). Defaults keep existing local & Railway behavior; no runtime branch on these yet.
    APP_ENV: str = Field(default="development", env="APP_ENV")
    #: e.g. local | aliyun — informational / future routing only
    APP_DEPLOY_TARGET: str = Field(default="local", env="APP_DEPLOY_TARGET")
    #: Browser-facing marketing/site origin, e.g. https://www.vibeclip.cn (optional; distinct from FRONTEND_URL when both set)
    PUBLIC_SITE_URL: Optional[str] = Field(default=None, env="PUBLIC_SITE_URL")
    #: Public API origin for documentation / future features, e.g. https://api.vibeclip.cn (optional; billing notify fallback remains BACKEND_PUBLIC_BASE_URL)
    API_BASE_URL: Optional[str] = Field(default=None, env="API_BASE_URL")
    #: r2 = Cloudflare R2 (current default, boto3 client unchanged); oss = reserved for Aliyun OSS
    STORAGE_PROVIDER: str = Field(default="r2", env="STORAGE_PROVIDER")
    #: direct_xai = backend calls xAI; gateway = reserved outbound gateway; railway_proxy = outbound AI via Railway AI Proxy (AI_PROXY_*); currently S1 vision uses this switch.
    AI_PROVIDER: str = Field(default="direct_xai", env="AI_PROVIDER")
    #: When AI_PROVIDER=gateway is wired, use these; empty has no effect on direct_xai
    AI_GATEWAY_BASE_URL: Optional[str] = Field(default=None, env="AI_GATEWAY_BASE_URL")
    AI_GATEWAY_API_KEY: Optional[str] = Field(default=None, env="AI_GATEWAY_API_KEY")

    # S1 product image understanding — geoq = legacy GeoQ experiment only (not Railway). unset (= xAI multimodal). Not model names.
    S1_VISION_PROVIDER: Optional[str] = Field(default=None, env="S1_VISION_PROVIDER")
    #: Railway AI Proxy root URL (no path); model config lives on proxy
    AI_PROXY_BASE_URL: Optional[str] = Field(default=None, env="AI_PROXY_BASE_URL")
    AI_PROXY_TOKEN: Optional[str] = Field(default=None, env="AI_PROXY_TOKEN")
    AI_PROXY_TIMEOUT_SECONDS: int = Field(default=120, env="AI_PROXY_TIMEOUT_SECONDS")
    GEOQ_BASE_URL: str = Field(default="https://api.geoq.help/v1", env="GEOQ_BASE_URL")
    GEOQ_API_KEY: Optional[str] = Field(default=None, env="GEOQ_API_KEY")
    GEOQ_S1_VISION_MODEL: str = Field(default="gpt-image-2", env="GEOQ_S1_VISION_MODEL")
    GEOQ_TIMEOUT_SECONDS: int = Field(default=120, env="GEOQ_TIMEOUT_SECONDS")

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

    # Alipay Configuration
    ALIPAY_APP_ID: Optional[str] = Field(default=None, env="ALIPAY_APP_ID")
    ALIPAY_PRIVATE_KEY: Optional[str] = Field(default=None, env="ALIPAY_PRIVATE_KEY")
    ALIPAY_PUBLIC_KEY: Optional[str] = Field(default=None, env="ALIPAY_PUBLIC_KEY")
    ALIPAY_GATEWAY: str = Field(default="https://openapi.alipay.com/gateway.do", env="ALIPAY_GATEWAY")
    ALIPAY_NOTIFY_URL: Optional[str] = Field(default=None, env="ALIPAY_NOTIFY_URL")
    ALIPAY_RETURN_URL: Optional[str] = Field(default=None, env="ALIPAY_RETURN_URL")
    #: Public API origin for Alipay notify_url when ALIPAY_NOTIFY_URL is unset, e.g. https://api.vibeclip.cn
    BACKEND_PUBLIC_BASE_URL: Optional[str] = Field(default=None, env="BACKEND_PUBLIC_BASE_URL")
    ALIPAY_SIGN_TYPE: str = Field(default="RSA2", env="ALIPAY_SIGN_TYPE")

    # WeChat Pay API v3 (Native QR, PC Web)
    WECHAT_PAY_ENABLED: bool = Field(default=False, env="WECHAT_PAY_ENABLED")
    WECHAT_PAY_APPID: Optional[str] = Field(default=None, env="WECHAT_PAY_APPID")
    WECHAT_PAY_MCHID: Optional[str] = Field(default=None, env="WECHAT_PAY_MCHID")
    WECHAT_PAY_API_V3_KEY: Optional[str] = Field(default=None, env="WECHAT_PAY_API_V3_KEY")
    WECHAT_PAY_MCH_SERIAL_NO: Optional[str] = Field(default=None, env="WECHAT_PAY_MCH_SERIAL_NO")
    #: PEM PKCS8; env may use literal \\n for newlines
    WECHAT_PAY_PRIVATE_KEY: Optional[str] = Field(default=None, env="WECHAT_PAY_PRIVATE_KEY")
    WECHAT_PAY_NOTIFY_URL: Optional[str] = Field(default=None, env="WECHAT_PAY_NOTIFY_URL")
    #: 回调「微信支付公钥」模式：须与 Wechatpay-Serial 完全一致（通常以 PUB_KEY_ / PUB_KEY_ID_ 开头）
    WECHAT_PAY_PUBLIC_KEY_ID: Optional[str] = Field(default=None, env="WECHAT_PAY_PUBLIC_KEY_ID")
    #: PEM 公钥；环境变量可用 \\n 表示换行
    WECHAT_PAY_PUBLIC_KEY: Optional[str] = Field(default=None, env="WECHAT_PAY_PUBLIC_KEY")

    # X AI API Configuration
    XAI_API_KEY: Optional[str] = None
    XAI_API_URL: str = "https://api.x.ai/v1"
    XAI_MODEL: Optional[str] = None  # Must be set explicitly via environment variable
    X_ANALYSIS_PROVIDER: str = "mock"  # Options: "mock", "xai"

    # Short Drama / xAI text (Responses API); base URL falls back to XAI_API_URL when unset
    XAI_BASE_URL: Optional[str] = Field(default=None, env="XAI_BASE_URL")
    XAI_TEXT_MODEL: Optional[str] = Field(default=None, env="XAI_TEXT_MODEL")
    #: S2 Story Planner only; empty → same as global text model (effective_xai_text_model)
    XAI_STORY_MODEL: Optional[str] = Field(default=None, env="XAI_STORY_MODEL")
    #: S2 Story Planner max output tokens (Responses API); S1/S3/S4 unchanged
    XAI_STORY_MAX_OUTPUT_TOKENS: int = Field(default=16384, env="XAI_STORY_MAX_OUTPUT_TOKENS")
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
    FRONTEND_URL: Optional[str] = Field(default=None, env="FRONTEND_URL")
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
