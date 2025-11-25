#!/bin/bash

# Load .env manually (since shell doesn't do it automatically)
export $(grep -v '^#' .env | xargs)

echo "Using DATABASE_URL=$DATABASE_URL"

# Move to classifier directory
cd ml/classifier_service

# Run retraining
python3 retrain.py