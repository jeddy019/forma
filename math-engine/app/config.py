from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    math_engine_secret: str = ""
    port: int = 8000
    log_level: str = "info"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
