"""
CivicTwin ML Audit — Classifier, Sentiment, Topic Services
Ports: Classifier=8001, Sentiment=6001, Topic=6002
"""
import json, time, requests, statistics, sys
from datetime import datetime, timezone

REQUEST_TIMEOUT = 3
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report
)

AUDIT_TS = datetime.now(timezone.utc).isoformat()

# ─── TEST DATASETS ────────────────────────────────────────────────────────────

CLASSIFIER_TESTS = [
    # road (25)
    ("Pothole causing traffic near main road", "road"),
    ("Deep pothole at bus stop entrance", "road"),
    ("Damaged road near school zone", "road"),
    ("Broken speed bump causing vehicle imbalance", "road"),
    ("Road cracked due to heavy trucks", "road"),
    ("Accident occurred near highway junction", "road"),
    ("Construction debris blocking the road", "road"),
    ("Street divider damaged near market", "road"),
    ("Traffic signal not working causing congestion", "road"),
    ("Newly laid road already damaged", "road"),
    ("Road collapse near bridge area", "road"),
    ("Pedestrian crossing faded completely", "road"),
    ("Footpath broken leading to road hazard", "road"),
    ("Road construction left incomplete", "road"),
    ("Broken divider near circle", "road"),
    ("Illegal parking blocking road movement", "road"),
    ("Manhole cover missing causing accident risk", "road"),
    ("Roadside barricade broken near turn", "road"),
    ("Vehicles skidding on oily road surface", "road"),
    ("Sharp stones on road damaging tyres", "road"),
    ("Heavy traffic due to road narrowing", "road"),
    ("Sidewalk broken merging with main road", "road"),
    ("Footpath merged with road due to erosion", "road"),
    ("Road blocked by construction material", "road"),
    ("Uneven road surface causing accidents daily", "road"),
    # water (25)
    ("Water leakage from underground pipe", "water"),
    ("Massive water leak near street corner", "water"),
    ("Water flooding due to pipe burst", "water"),
    ("Tap water supply very low pressure", "water"),
    ("Contaminated water coming in taps", "water"),
    ("Water supply completely stopped today", "water"),
    ("Water pipeline broken near shop", "water"),
    ("Overhead tank overflow causing water wastage", "water"),
    ("Dirty water flowing on the street", "water"),
    ("Sewage water entering houses", "water"),
    ("Underground drainage clogged causing overflow", "water"),
    ("Foul smell from stagnant water", "water"),
    ("Water draining slowly from area", "water"),
    ("Storm water drain blocked due to plastic", "water"),
    ("Main line water leak causing severe loss", "water"),
    ("Sewage line burst in the lane", "water"),
    ("Water stagnation creating mosquito breeding", "water"),
    ("Basement filled with drainage water", "water"),
    ("Drinking water mixed with mud", "water"),
    ("No fresh water supply today", "water"),
    ("Water gushing from underground valve", "water"),
    ("Leak in main water line near market", "water"),
    ("Drain water mixed with drinking water", "water"),
    ("Water flowing onto road due to pipe breakage", "water"),
    ("Water tank overflow for many hours", "water"),
    # electricity (25)
    ("Electric pole wire hanging dangerously", "electricity"),
    ("Transformer making loud noise and heating", "electricity"),
    ("Sparks coming from electric line", "electricity"),
    ("Frequent power outage in locality", "electricity"),
    ("Loose electrical connection near pole", "electricity"),
    ("Electric pole tilted due to rust", "electricity"),
    ("Short circuit near shop causing smoke", "electricity"),
    ("High voltage issue damaging appliances", "electricity"),
    ("Street lights not functioning at night", "electricity"),
    ("Transformer oil leakage observed", "electricity"),
    ("Electric wire fallen on road", "electricity"),
    ("Power fluctuation during evening peak", "electricity"),
    ("Exposed electric cable near footpath", "electricity"),
    ("Transformer explosion sound heard", "electricity"),
    ("Wires sparking near residential area", "electricity"),
    ("Half of the street has no power supply", "electricity"),
    ("Electric board open and dangerous", "electricity"),
    ("Short circuit causing blackout in area", "electricity"),
    ("Transformer blast near colony", "electricity"),
    ("Pole leaning dangerously after storm", "electricity"),
    ("Electric line cut during rain", "electricity"),
    ("Street light fuse blown repeatedly", "electricity"),
    ("Power cut in early morning hours", "electricity"),
    ("Transformer smoking continuously near homes", "electricity"),
    ("High tension wire hanging low over road", "electricity"),
    # sanitation (25)
    ("Garbage dumped on roadside causing smell", "sanitation"),
    ("Street garbage not collected for days", "sanitation"),
    ("Huge pile of waste causing smell", "sanitation"),
    ("Open drainage causing foul smell", "sanitation"),
    ("Drain blocked due to mud and plastic", "sanitation"),
    ("Stray dogs near garbage pile", "sanitation"),
    ("Overflowing dustbins near apartments", "sanitation"),
    ("Dead animal on street causing stench", "sanitation"),
    ("Public toilet unclean and unusable", "sanitation"),
    ("Garbage burning near residential houses", "sanitation"),
    ("Sewage overflowing due to blockage", "sanitation"),
    ("Plastic waste scattered everywhere", "sanitation"),
    ("Drainage cover broken causing hazard", "sanitation"),
    ("Unclean market area with waste", "sanitation"),
    ("Cleaning staff not attending street", "sanitation"),
    ("Drainage backflow in residential area", "sanitation"),
    ("Trash mixed with rain water causing smell", "sanitation"),
    ("Garbage scattered due to no collection", "sanitation"),
    ("Open dumping at empty plot", "sanitation"),
    ("Garbage heap attracting insects", "sanitation"),
    ("Drainage line broken near shop", "sanitation"),
    ("Stagnant sewage water on footpath", "sanitation"),
    ("Overflowing wet waste bin near school", "sanitation"),
    ("Trash not collected from lane for a week", "sanitation"),
    ("Improper waste management in colony", "sanitation"),
]

SENTIMENT_TESTS = [
    # positive (34)
    ("The roads in our area have been repaired beautifully, very happy!", "positive"),
    ("Water supply restored and running clean, thank you!", "positive"),
    ("Street lights working perfectly now, great job!", "positive"),
    ("Garbage collection is now regular, residents are happy", "positive"),
    ("The new park is excellent and well maintained", "positive"),
    ("Civic workers did a fantastic job fixing the pothole", "positive"),
    ("Drainage work completed successfully, area looks clean", "positive"),
    ("Very satisfied with the quick response to our complaint", "positive"),
    ("The electricity supply has improved a lot this month", "positive"),
    ("New footpath is smooth and safe, thank the corporation", "positive"),
    ("Wonderful improvement in sanitation services this week", "positive"),
    ("Power supply is stable now, great improvement", "positive"),
    ("Clean drinking water available 24 hours now", "positive"),
    ("The road widening project is a huge success", "positive"),
    ("Excellent cleanliness drive in the neighborhood", "positive"),
    ("Water pressure has improved significantly", "positive"),
    ("Happy to see broken streetlights finally repaired", "positive"),
    ("The area looks so much better after cleanup", "positive"),
    ("Quick action on transformer repair, very impressive", "positive"),
    ("Pothole fixed within a day, outstanding service", "positive"),
    ("Drainage blockage cleared, no more flooding", "positive"),
    ("The new water pipeline is working efficiently", "positive"),
    ("Waste collection is now daily, great initiative", "positive"),
    ("Electric connections made safe and proper", "positive"),
    ("Happy with the swift maintenance team response", "positive"),
    ("Road markings clearly done, safety improved", "positive"),
    ("Overhead water tank serviced properly now", "positive"),
    ("Garbage bins cleaned and sanitized regularly", "positive"),
    ("Traffic signal working now, smooth flow", "positive"),
    ("Community appreciated the speedy repair work", "positive"),
    ("Sewage cleaned, no more foul smell in area", "positive"),
    ("Public toilets renovated and very clean now", "positive"),
    ("Electric pole straightened and made safe", "positive"),
    ("Water leak fixed promptly by the authorities", "positive"),
    # negative (33)
    ("This pothole has been here for months, absolutely terrible", "negative"),
    ("No water supply for three days, worst situation", "negative"),
    ("Power cuts every night, extremely frustrating", "negative"),
    ("Garbage not picked up in weeks, disgusting smell everywhere", "negative"),
    ("Sewage overflow on the road, authorities don't care at all", "negative"),
    ("Electric wire dangerously hanging, nobody responding", "negative"),
    ("Dirty water coming from taps, health risk ignored", "negative"),
    ("Road is completely broken, accidents happening daily", "negative"),
    ("Street lights broken for months, area is unsafe at night", "negative"),
    ("Drainage blocked causing flooding, terrible management", "negative"),
    ("Transformer sparking since last week, no action taken", "negative"),
    ("Open sewage line causing disease risk, shameful neglect", "negative"),
    ("Complaint filed 10 times but no response, frustrated", "negative"),
    ("Garbage burning near park causing air pollution", "negative"),
    ("Water supply stopped without any notice, unacceptable", "negative"),
    ("Road collapse happened and still no repair after days", "negative"),
    ("Dead animals on road, no one clearing them, horrible", "negative"),
    ("Public toilet completely filthy and non-functional", "negative"),
    ("Manhole open for weeks, child almost fell inside", "negative"),
    ("Power fluctuation damaging appliances, no compensation", "negative"),
    ("Sewage water entering homes, authorities not responding", "negative"),
    ("Road construction abandoned midway, massive inconvenience", "negative"),
    ("No drinking water in summer, this is unacceptable", "negative"),
    ("High tension wire touching trees, dangerous situation ignored", "negative"),
    ("Overflowing dustbins causing disease, poor civic management", "negative"),
    ("Pipe burst two days ago, water wasted, no repair team", "negative"),
    ("Electricity tripping every hour, appliances getting damaged", "negative"),
    ("Broken road near school, children at risk daily", "negative"),
    ("Storm drain overflowing into houses, disaster management failed", "negative"),
    ("No action on repeated complaints about garbage heap", "negative"),
    ("Water meter broken, getting incorrect high bills", "negative"),
    ("Electric meter box open and sparking, very dangerous", "negative"),
    ("Footpath blocked by illegal shops, pedestrians unsafe", "negative"),
    # neutral (33)
    ("Water supply may be disrupted tomorrow for maintenance", "neutral"),
    ("Scheduled power outage from 10am to 2pm today", "neutral"),
    ("Road repair work in progress near the junction", "neutral"),
    ("Garbage collection timing changed to morning hours", "neutral"),
    ("New drainage pipeline installation work started today", "neutral"),
    ("Electricity meter reading being done this week", "neutral"),
    ("Water supply schedule is 6am to 8am daily", "neutral"),
    ("Road maintenance crew spotted working near market", "neutral"),
    ("Transformer servicing work planned for Sunday", "neutral"),
    ("Sanitation workers on strike, affecting collection", "neutral"),
    ("Pothole reported at junction 3, team assigned", "neutral"),
    ("Water pipeline extension work underway in sector 4", "neutral"),
    ("Street light installation work in progress", "neutral"),
    ("Complaint registered for drainage issue, case opened", "neutral"),
    ("Road closed for maintenance between 11pm and 5am", "neutral"),
    ("Electrical inspection being done in old city area", "neutral"),
    ("Sewage line cleaning scheduled for this week", "neutral"),
    ("Water tanker supply available from 7am daily", "neutral"),
    ("Traffic diversion due to road repair work", "neutral"),
    ("Garbage bins repositioned to new locations", "neutral"),
    ("Electric board survey team visiting area tomorrow", "neutral"),
    ("Rain expected, drainage team on standby", "neutral"),
    ("Water pressure test being conducted today", "neutral"),
    ("Road marking work in progress on main street", "neutral"),
    ("Waste management awareness drive conducted today", "neutral"),
    ("Complaint acknowledged, action pending", "neutral"),
    ("New electric poles being installed on main road", "neutral"),
    ("Water pipe replacement work started near colony", "neutral"),
    ("Footpath repair in progress near bus stand", "neutral"),
    ("Power restoration work expected by evening", "neutral"),
    ("Drainage survey team inspecting the area today", "neutral"),
    ("Road widening proposal approved by municipality", "neutral"),
    ("Garbage truck route updated for new sectors", "neutral"),
]

TOPIC_TESTS = [
    # Each entry: (documents_list, expected_dominant_topic_keyword)
    (["Pothole near school causing accidents", "Road broken after rain", "Damaged road near market"], "road"),
    (["Water leakage from pipe", "No water supply today", "Contaminated water in taps"], "water"),
    (["Electric sparks from pole", "Power outage at night", "Transformer smoking"], "electricity"),
    (["Garbage not collected", "Sewage overflowing on street", "Dustbin overflowing"], "garbage"),
    (["Pothole causing traffic jam", "Road divider broken", "Road repair needed urgently"], "road"),
    (["Water stagnation near homes", "Drain blocked due to plastic", "Sewage entering houses"], "water"),
    (["Street light not working", "Power cut for three days", "Electric wire hanging low"], "electricity"),
    (["Open drainage causing smell", "Garbage burning near park", "Public toilet unusable"], "garbage"),
    (["Road collapse near bridge", "Broken footpath on main road", "Traffic signal broken"], "road"),
    (["Water pipeline burst on main road", "No fresh water supply", "Overhead tank overflow"], "water"),
]


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def call_with_timing(fn):
    t0 = time.time()
    result = fn()
    latency_ms = int((time.time() - t0) * 1000)
    return result, latency_ms

def compute_metrics(y_true, y_pred, confidences, latencies, labels):
    correct = [p == t for p, t in zip(y_pred, y_true)]
    acc = round(accuracy_score(y_true, y_pred), 4)
    prec = round(precision_score(y_true, y_pred, average="macro", zero_division=0), 4)
    rec = round(recall_score(y_true, y_pred, average="macro", zero_division=0), 4)
    f1 = round(f1_score(y_true, y_pred, average="macro", zero_division=0), 4)
    avg_conf = round(sum(confidences) / len(confidences), 4) if confidences else 0.0
    latencies_sorted = sorted(latencies)
    p50 = latencies_sorted[len(latencies_sorted) // 2]
    p95 = latencies_sorted[int(len(latencies_sorted) * 0.95)]
    return {
        "accuracy": acc,
        "precision_macro": prec,
        "recall_macro": rec,
        "f1_macro": f1,
        "avg_confidence": avg_conf,
        "error_rate": round(1 - acc, 4),
        "latency_p50_ms": p50,
        "latency_p95_ms": p95,
    }

def class_breakdown(y_true, y_pred, labels):
    report = classification_report(y_true, y_pred, labels=labels, output_dict=True, zero_division=0)
    result = []
    for cls in labels:
        d = report.get(cls, {})
        result.append({
            "class": cls,
            "precision": round(d.get("precision", 0), 4),
            "recall": round(d.get("recall", 0), 4),
            "f1": round(d.get("f1-score", 0), 4),
            "support": int(d.get("support", 0)),
        })
    return result

def detect_flags(metrics, breakdown, overconf_cases, underconf_cases, service_name):
    flags = []
    if metrics["accuracy"] < 0.80:
        flags.append({"type": "FAILING", "detail": f"Accuracy {metrics['accuracy']*100:.1f}% is below 80% threshold"})
    if overconf_cases:
        flags.append({"type": "OVERCONFIDENCE", "detail": f"{len(overconf_cases)} predictions with conf>0.8 but wrong"})
    if underconf_cases:
        flags.append({"type": "UNDERCONFIDENCE", "detail": f"{len(underconf_cases)} correct predictions with conf<0.5"})
    for cls in breakdown:
        if cls["recall"] < 0.6:
            flags.append({"type": "WEAK_CLASS", "detail": f"Class '{cls['class']}' recall={cls['recall']:.2f} < 0.6"})
    if metrics["latency_p95_ms"] > 2000:
        flags.append({"type": "LATENCY", "detail": f"p95 latency {metrics['latency_p95_ms']}ms exceeds 2000ms"})
    return flags

def determine_status(flags):
    types = {f["type"] for f in flags}
    if "FAILING" in types:
        return "FAILING"
    if types:
        return "DEGRADED"
    return "PASSING"

# ─── CLASSIFIER AUDIT ─────────────────────────────────────────────────────────

def audit_classifier():
    url = "http://localhost:8001/classify"
    y_true, y_pred, confidences, latencies = [], [], [], []
    errors, failures, overconf, underconf = [], [], [], []

    print(f"\n[Classifier] Running {len(CLASSIFIER_TESTS)} tests...")
    for text, label in CLASSIFIER_TESTS:
        try:
            resp, ms = call_with_timing(lambda t=text: requests.post(url, json={"text": t}, timeout=REQUEST_TIMEOUT))
            latencies.append(ms)
            if resp.status_code != 200:
                errors.append({"input": text, "error": f"HTTP {resp.status_code}"})
                continue
            data = resp.json()
            predicted = data.get("category", "")
            # confidence = max probability from probs dict
            probs = data.get("probs", {})
            conf = max(probs.values()) if probs else data.get("priority", 0.5)
            y_true.append(label)
            y_pred.append(predicted)
            confidences.append(conf)
            if predicted != label:
                failures.append({"input": text, "expected": label, "predicted": predicted, "confidence": round(conf, 4)})
                if conf > 0.8:
                    overconf.append((text, label, predicted, conf))
            else:
                if conf < 0.5:
                    underconf.append((text, label, predicted, conf))
        except Exception as e:
            errors.append({"input": text, "error": str(e)})

    if not y_true:
        return {"name": "classifier_service", "status": "UNREACHABLE", "error": str(errors[:3])}

    labels = ["road", "water", "electricity", "sanitation"]
    metrics = compute_metrics(y_true, y_pred, confidences, latencies, labels)
    bd = class_breakdown(y_true, y_pred, labels)
    flags = detect_flags(metrics, bd, overconf, underconf, "classifier")
    print(f"  Accuracy: {metrics['accuracy']*100:.1f}%  |  F1: {metrics['f1_macro']:.3f}  |  Errors: {len(errors)}"); sys.stdout.flush()
    return {
        "name": "classifier_service",
        "status": determine_status(flags),
        "metrics": metrics,
        "class_breakdown": bd,
        "flags": flags,
        "sample_failures": failures[:5],
        "api_errors": errors[:5],
    }

# ─── SENTIMENT AUDIT ──────────────────────────────────────────────────────────

def audit_sentiment():
    url = "http://localhost:6001/sentiment"
    y_true, y_pred, confidences, latencies = [], [], [], []
    errors, failures, overconf, underconf = [], [], [], []

    print(f"\n[Sentiment] Running {len(SENTIMENT_TESTS)} tests...")
    for text, label in SENTIMENT_TESTS:
        try:
            resp, ms = call_with_timing(lambda t=text: requests.post(url, json={"text": t}, timeout=REQUEST_TIMEOUT))
            latencies.append(ms)
            if resp.status_code != 200:
                errors.append({"input": text, "error": f"HTTP {resp.status_code}"})
                continue
            data = resp.json()
            predicted = data.get("label", "")
            raw_score = data.get("score", 0.0)
            # VADER compound is -1 to 1; map to 0-1 confidence
            conf = abs(raw_score)
            y_true.append(label)
            y_pred.append(predicted)
            confidences.append(conf)
            if predicted != label:
                failures.append({"input": text, "expected": label, "predicted": predicted, "confidence": round(conf, 4)})
                if conf > 0.8:
                    overconf.append((text, label, predicted, conf))
            else:
                if conf < 0.5:
                    underconf.append((text, label, predicted, conf))
        except Exception as e:
            errors.append({"input": text, "error": str(e)})

    if not y_true:
        return {"name": "sentiment_service", "status": "UNREACHABLE", "error": str(errors[:3])}

    labels = ["positive", "negative", "neutral"]
    metrics = compute_metrics(y_true, y_pred, confidences, latencies, labels)
    bd = class_breakdown(y_true, y_pred, labels)
    flags = detect_flags(metrics, bd, overconf, underconf, "sentiment")
    print(f"  Accuracy: {metrics['accuracy']*100:.1f}%  |  F1: {metrics['f1_macro']:.3f}  |  Errors: {len(errors)}"); sys.stdout.flush()
    return {
        "name": "sentiment_service",
        "status": determine_status(flags),
        "metrics": metrics,
        "class_breakdown": bd,
        "flags": flags,
        "sample_failures": failures[:5],
        "api_errors": errors[:5],
    }

# ─── TOPIC AUDIT ──────────────────────────────────────────────────────────────

def audit_topic():
    """
    YAKE is unsupervised keyword extraction — no single predicted label.
    We evaluate: does the top extracted keyword contain the expected domain keyword?
    Confidence = 1 - normalized YAKE score (lower YAKE score = more relevant).
    """
    url = "http://localhost:6002/extract"
    y_true, y_pred, confidences, latencies = [], [], [], []
    errors, failures, overconf, underconf = [], [], [], []
    DOMAIN_MAP = {
        "road": ["road", "pothole", "traffic", "footpath", "divider", "junction"],
        "water": ["water", "leak", "pipe", "sewage", "drain", "supply"],
        "electricity": ["electric", "power", "transformer", "outage", "light", "wire"],
        "garbage": ["garbage", "sewage", "drain", "dustbin", "waste", "smell", "sanitation"],
    }

    print(f"\n[Topic] Running {len(TOPIC_TESTS)} tests...")
    for docs, expected_domain in TOPIC_TESTS:
        try:
            resp, ms = call_with_timing(lambda d=docs: requests.post(url, json={"documents": d, "top_n": 10}, timeout=REQUEST_TIMEOUT))
            latencies.append(ms)
            if resp.status_code != 200:
                errors.append({"input": str(docs[:1]), "error": f"HTTP {resp.status_code}"})
                continue
            data = resp.json()
            topics = data.get("topics", [])
            if not topics:
                errors.append({"input": str(docs[:1]), "error": "empty topics"})
                continue

            # Check if any top-5 keywords match expected domain
            top5_kws = [t["topic"].lower() for t in topics[:5]]
            domain_kws = DOMAIN_MAP.get(expected_domain, [expected_domain])
            matched_domain = None
            for kw in top5_kws:
                for dk in domain_kws:
                    if dk in kw:
                        matched_domain = expected_domain
                        break
                if matched_domain:
                    break

            # Also check: which domain has the most keyword hits in top-5
            if not matched_domain:
                best, best_count = None, 0
                for domain, dkws in DOMAIN_MAP.items():
                    count = sum(1 for kw in top5_kws for dk in dkws if dk in kw)
                    if count > best_count:
                        best_count = count
                        best = domain
                matched_domain = best if best else "unknown"

            # YAKE score: lower = more confident. Normalize: conf = 1/(1+score)
            best_score = topics[0]["score"] if topics else 1.0
            conf = round(1 / (1 + best_score), 4)

            y_true.append(expected_domain)
            y_pred.append(matched_domain)
            confidences.append(conf)
            if matched_domain != expected_domain:
                failures.append({
                    "input": docs[0],
                    "expected": expected_domain,
                    "predicted": matched_domain,
                    "top_keywords": top5_kws,
                    "confidence": conf,
                })
                if conf > 0.8:
                    overconf.append((docs[0], expected_domain, matched_domain, conf))
            else:
                if conf < 0.5:
                    underconf.append((docs[0], expected_domain, matched_domain, conf))
        except Exception as e:
            errors.append({"input": str(docs[:1]), "error": str(e)})

    if not y_true:
        return {"name": "topic_service", "status": "UNREACHABLE", "error": str(errors[:3])}

    labels = list(dict.fromkeys([t for _, t in TOPIC_TESTS]))
    metrics = compute_metrics(y_true, y_pred, confidences, latencies, labels)
    bd = class_breakdown(y_true, y_pred, labels)
    flags = detect_flags(metrics, bd, overconf, underconf, "topic")
    print(f"  Accuracy: {metrics['accuracy']*100:.1f}%  |  F1: {metrics['f1_macro']:.3f}  |  Errors: {len(errors)}"); sys.stdout.flush()
    return {
        "name": "topic_service",
        "status": determine_status(flags),
        "metrics": metrics,
        "class_breakdown": bd,
        "flags": flags,
        "sample_failures": failures[:5],
        "api_errors": errors[:5],
    }


# ─── MAIN ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  CivicTwin ML Audit")
    print(f"  {AUDIT_TS}")
    print("=" * 60)

    results = [audit_classifier(), audit_sentiment(), audit_topic()]

    passing  = sum(1 for r in results if r.get("status") == "PASSING")
    failing  = sum(1 for r in results if r.get("status") == "FAILING")
    degraded = sum(1 for r in results if r.get("status") == "DEGRADED")
    unreachable = sum(1 for r in results if r.get("status") == "UNREACHABLE")

    if failing > 0:
        rec = "Immediate investigation required for FAILING services."
    elif degraded > 0:
        rec = "Review DEGRADED services; monitor closely before next release."
    elif unreachable > 0:
        rec = "Start unreachable services and re-run audit."
    else:
        rec = "All services healthy. Continue normal operations."

    report = {
        "audit_timestamp": AUDIT_TS,
        "services": results,
        "summary": {
            "total_services": 3,
            "passing": passing,
            "failing": failing,
            "degraded": degraded,
            "unreachable": unreachable,
            "overall_recommendation": rec,
        },
    }

    out_path = "l:/civicTwin/reports/ml_audit_report.json"
    import os; os.makedirs("l:/civicTwin/reports", exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 60)
    print("  AUDIT SUMMARY")
    print("=" * 60)
    for svc in results:
        m = svc.get("metrics", {})
        acc = f"{m.get('accuracy', 0)*100:.1f}%" if m else "N/A"
        f1  = f"{m.get('f1_macro', 0):.3f}"      if m else "N/A"
        print(f"  {svc['name']:<25} status={svc['status']:<12} acc={acc:<8} f1={f1}")
    print(f"\n  Passing={passing}  Failing={failing}  Degraded={degraded}  Unreachable={unreachable}")
    print(f"  Recommendation: {rec}")
    print(f"\n  Full report → {out_path}")
    print("=" * 60)
