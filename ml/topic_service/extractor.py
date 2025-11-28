import yake

def extract_keywords_from_documents(documents, top_n=20):
    text = " \n ".join([d for d in documents if d])

    if not text.strip():
        return []

    kw_extractor = yake.KeywordExtractor(
        lan="en",
        n=1,
        top=top_n
    )
    keywords = kw_extractor.extract_keywords(text)

    # keywords = [(keyword, score)]
    topics = [
        {"topic": kw, "score": float(score)}
        for kw, score in keywords
    ]

    return topics
