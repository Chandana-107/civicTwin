# ml/classifier_service/evaluate.py
import argparse, joblib, pandas as pd
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from utils import save_metrics

def evaluate(labels_csv, model_dir):
    df = pd.read_csv(labels_csv).dropna(subset=["text", "category"])
    X = df["text"].astype(str)
    y = df["category"].astype(str)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    vec = joblib.load(f"{model_dir}/tfidf.joblib")
    model = joblib.load(f"{model_dir}/logreg.joblib")

    X_test_vec = vec.transform(X_test)
    preds = model.predict(X_test_vec)

    report = classification_report(y_test, preds, output_dict=True)
    cm = confusion_matrix(y_test, preds).tolist()

    out = save_metrics({"report": report, "confusion_matrix": cm})
    print("Saved metrics →", out)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--labels", default="../../infra/labels.csv")
    parser.add_argument("--models", default="models")
    args = parser.parse_args()
    evaluate(args.labels, args.models)
