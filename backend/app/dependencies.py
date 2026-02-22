from app.config import settings
from app.services.data_service import DataService
from app.services.prediction_service import PredictionService
from app.services.scoring_service import ScoringService
from app.services.upload_service import UploadService
from app.services.weather_service import WeatherService
from app.services.code_execution_service import CodeExecutionService
from app.services.chat_service import ChatService

_data_service: DataService | None = None
_prediction_service: PredictionService | None = None
_scoring_service: ScoringService | None = None
_upload_service: UploadService | None = None
_weather_service: WeatherService | None = None
_code_execution_service: CodeExecutionService | None = None
_chat_service: ChatService | None = None


def init_services():
    global _data_service, _prediction_service, _scoring_service
    global _upload_service, _weather_service, _code_execution_service, _chat_service

    _data_service = DataService(settings.data_dir)
    _prediction_service = PredictionService(
        data_service=_data_service, model_dir=settings.model_dir
    )
    _scoring_service = ScoringService(
        data_service=_data_service, prediction_service=_prediction_service
    )
    _upload_service = UploadService(
        data_service=_data_service, scoring_service=_scoring_service
    )
    _weather_service = WeatherService()
    _code_execution_service = CodeExecutionService(
        data_dir=str(settings.data_dir)
    )
    _chat_service = ChatService(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        code_execution_service=_code_execution_service,
        prediction_service=_prediction_service,
    )


def get_data_service() -> DataService:
    assert _data_service is not None
    return _data_service


def get_prediction_service() -> PredictionService:
    assert _prediction_service is not None
    return _prediction_service


def get_scoring_service() -> ScoringService:
    assert _scoring_service is not None
    return _scoring_service


def get_upload_service() -> UploadService:
    assert _upload_service is not None
    return _upload_service


def get_weather_service() -> WeatherService:
    assert _weather_service is not None
    return _weather_service


def get_chat_service() -> ChatService:
    assert _chat_service is not None
    return _chat_service
