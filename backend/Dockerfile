FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/. .
COPY assets/icons/ assets/icons/
RUN mkdir -p assets/icons/generated
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
