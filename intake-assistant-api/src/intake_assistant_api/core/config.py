from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str = ""
    sdwc_api_url: str = "http://localhost:8080"

    app_name: str = "intake-assistant-api"
    debug: bool = False


settings = Settings()
