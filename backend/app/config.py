from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    db_host: str
    db_port: int = 5432
    db_user: str
    db_password: str
    db_name: str
    app_user_1: str
    app_pass_1: str
    app_user_2: str
    app_pass_2: str
    print_service_url: str = "http://host.docker.internal:9100"
    openai_api_key: str = ""
    openai_image_model: str = "gpt-image-1"

    class Config:
        env_file = ".env"

settings = Settings()
