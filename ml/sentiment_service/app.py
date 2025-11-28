# ml/sentiment_service/app.py
from flask import Flask, request, jsonify
from utils import analyze_sentiment

app = Flask(__name__)

@app.route("/sentiment", methods=["POST"])
def sentiment():
    data = request.get_json(force=True)
    text = data.get("text", "")
    res = analyze_sentiment(text)
    return jsonify(res)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6001)
