FROM python:3.12-slim
WORKDIR /app
COPY deploy/workspace/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && useradd --uid 10001 --create-home aetherion
COPY api /app/api
COPY core /app/core
COPY institution /app/institution
RUN mkdir /data && chown aetherion:aetherion /data
USER aetherion
EXPOSE 8000
CMD ["uvicorn", "api.workspace_app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-proxy-headers"]
