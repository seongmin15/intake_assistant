from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, message: str, status_code: int = 500) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class ExternalServiceError(AppError):
    def __init__(self, service: str, message: str) -> None:
        super().__init__(message=f"{service}: {message}", status_code=502)


class ValidationError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=422)


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message},
    )
