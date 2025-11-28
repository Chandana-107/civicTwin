# ml/sentiment_service/utils.py
from nltk.sentiment import SentimentIntensityAnalyzer
import nltk

# ensure lexicon available
nltk.download('vader_lexicon', quiet=True)

sia = SentimentIntensityAnalyzer()

def analyze_sentiment(text: str):
    """
    Returns dict: {label: 'positive'|'neutral'|'negative', score: compound}
    """
    if not text:
        return {"label": "neutral", "score": 0.0}
    score = sia.polarity_scores(text)
    compound = float(score.get('compound', 0.0))
    if compound >= 0.05:
        label = 'positive'
    elif compound <= -0.05:
        label = 'negative'
    else:
        label = 'neutral'
    return {"label": label, "score": compound}
