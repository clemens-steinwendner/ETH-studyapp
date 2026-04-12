from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Fireworks AI
    fireworks_api_key: str
    fireworks_model: str = "accounts/fireworks/models/deepseek-v3"
    fireworks_vision_model: str = "accounts/fireworks/models/llama-v3p2-11b-vision-instruct"

    # E2B
    e2b_api_key: str

    # Budget
    monthly_budget_usd: float = 8.00

    # Backend
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    database_url: str = "sqlite+aiosqlite:///./data/app.db"
    chroma_persist_dir: str = "./data/chroma"
    upload_dir: str = "./data/uploads"

    # ARQ
    redis_url: str = "redis://localhost:6379/0"


settings = Settings()  # type: ignore[call-arg]
