# Build stage — export requirements and install dependencies
FROM python:3.12-slim AS builder

WORKDIR /app

RUN pip install --no-cache-dir poetry==2.1.1 poetry-plugin-export==1.9.0

COPY intake-assistant-api/pyproject.toml intake-assistant-api/poetry.lock ./

RUN poetry export -f requirements.txt -o requirements.txt --without dev \
    && pip install --no-cache-dir --ignore-installed --prefix=/install -r requirements.txt

# Runtime stage — minimal image with only production dependencies
FROM python:3.12-slim

RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid 1000 --create-home appuser

WORKDIR /app

COPY --from=builder /install /usr/local
COPY intake-assistant-api/src/intake_assistant_api/ ./intake_assistant_api/

ENV PYTHONUNBUFFERED=1

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')"

CMD ["uvicorn", "intake_assistant_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
