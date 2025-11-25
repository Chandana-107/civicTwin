# ml/classifier_service/train.py
import argparse
import os
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from datetime import datetime

DEFAULT_LABELS = "../../infra/labels.csv"
DEFAULT_OUT_DIR = "models"

def train(labels_csv, out_dir):
    df = pd.read_csv(labels_csv).dropna(subset=["text", "category"])
    X = df["text"].astype(str)
    y = df["category"].astype(str)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    vectorizer = TfidfVectorizer(max_features=15000, ngram_range=(1, 2))
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    model = LogisticRegression(max_iter=1000)
    model.fit(X_train_vec, y_train)

    preds = model.predict(X_test_vec)
    acc = accuracy_score(y_test, preds)
    print("Accuracy:", acc)

    os.makedirs(out_dir, exist_ok=True)
    joblib.dump(vectorizer, f"{out_dir}/tfidf.joblib")
    joblib.dump(model, f"{out_dir}/logreg.joblib")

    with open(f"{out_dir}/version.txt", "w") as f:
        f.write(f"trained_at={datetime.utcnow().isoformat()}Z\n")
        f.write(f"accuracy={acc}\n")

    print("Saved model →", out_dir)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--labels", default=DEFAULT_LABELS)
    parser.add_argument("--out", default=DEFAULT_OUT_DIR)
    args = parser.parse_args()
    train(args.labels, args.out)
