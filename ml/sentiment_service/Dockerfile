# ── Sentiment Service — Python 3.12 / Flask + VADER ──────────
FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    flask==2.2.5 \
    nltk==3.8.1

# Pre-download VADER lexicon at build time so container starts instantly
RUN python -c "import nltk; nltk.download('vader_lexicon', quiet=True)"

COPY app.py utils.py ./

EXPOSE 6001
CMD ["python", "app.py"]
