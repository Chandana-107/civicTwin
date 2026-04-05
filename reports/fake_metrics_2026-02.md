# CivicTwin Synthetic Metrics Report — 2026-02-08

## Platform Overview
- Active users: 12,400 monthly; 1,150 daily
- New complaints/day: 420 (p95: 780)
- Resolution SLA met: 92% within 72 hours
- WhatsApp OTP success rate: 98.6%

## Backend API
- Requests/min: 320 avg; 950 peak
- Latency: p50 85 ms; p95 260 ms; p99 480 ms
- Error rate: 0.35% 5xx; 0.6% 4xx
- Upload throughput: 12 MB/s sustained

## ML Classifier (Complaint Category)
- Model version: v1.4.2 (logreg)
- Accuracy: 86.0%; Macro F1: 85.6%; Weighted F1: 85.9%
- Classes: electricity, garbage, public-safety, road, water
- Training set size: 18,500; Eval set: 1,320
- Confusion highlights: electricity ↔ road (≈15), garbage ↔ water (≈16)

## Sentiment Service
- Accuracy: 88%; Macro F1: 87%
- Class distribution: positive 34%; neutral 41%; negative 25%
- Latency: p50 38 ms; p95 110 ms

## Topic Service
- Topics discovered/day: 28 avg
- Coherence score (c_v): 0.61
- Tokens processed: 2.3M/day

## Fraud Detection
- Tender flags/day: 12 (precision 0.74; recall 0.69)
- Cluster updates: 3/day

## Simulation Service
- Runs/day: 24; Avg duration: 11m
- Agents per run: 42 avg

## Frontend (Vite)
- Bundle size: 317 KB gzipped
- Lighthouse: Performance 92; Accessibility 96; Best Practices 95; SEO 98

## Operations
- Uptime: 99.92% (last 30 days)
- DB CPU: 38% avg; 72% peak
- DB memory: 8.3 GB used (peak)
- Backups: 100% daily success