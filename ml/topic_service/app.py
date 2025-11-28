# ml/topic_service/app.py
from flask import Flask, request, jsonify
from extractor import extract_keywords_from_documents

app = Flask(__name__)

@app.route("/extract", methods=["POST"])
def extract():
    data = request.get_json(force=True)
    documents = data.get("documents", [])
    top_n = int(data.get("top_n", 20))
    topics = extract_keywords_from_documents(documents, top_n=top_n)
    return jsonify({"topics": topics})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6002)