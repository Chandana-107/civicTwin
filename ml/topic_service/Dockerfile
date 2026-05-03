# ── Topic Service — Python 3.12 / Flask + YAKE ───────────────
FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    flask==2.2.5 \
    yake==0.4.8

COPY app.py extractor.py ./

EXPOSE 6002
CMD ["python", "app.py"]
