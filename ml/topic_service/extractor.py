# ml/topic_service/extractor.py
from rake_nltk import Rake
import nltk
nltk.download('stopwords', quiet=True)

r = Rake()  # uses NLTK stopwords

def extract_keywords_from_documents(documents, top_n=20):
    """
    documents: list of strings
    returns: list of (phrase, score) sorted desc
    """
    # join docs into big text for RAKE or process per-doc and aggregate scores
    big_text = " \n ".join([d for d in documents if d])
    if not big_text.strip():
        return []
    r.extract_keywords_from_text(big_text)
    ranked = r.get_ranked_phrases_with_scores()  # [(score, phrase), ...] depending on version
    # Ensure normalized form: list of dicts
    out = []
    # rake returns (score, phrase) sometimes as (phrase, score) - handle both
    for item in ranked[:top_n]:
        if isinstance(item, tuple) or isinstance(item, list):
            # typical rake returns (score, phrase)
            if isinstance(item[0], (int, float)):
                score, phrase = item
            else:
                phrase, score = item
        else:
            continue
        out.append({"topic": phrase, "score": float(score)})
    return out