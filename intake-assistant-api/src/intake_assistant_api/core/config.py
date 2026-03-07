from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str = ""
    sdwc_api_url: str = "http://sdwc-api.sdwc.svc.cluster.local:8000"

    app_name: str = "intake-assistant-api"
    debug: bool = False

    rate_limit_requests: int = 20
    rate_limit_window_seconds: int = 60


settings = Settings()
