# seed_complaints.py
from infra.db import get_connection
import random

INDIAN_LOCALITIES = [
    "Indiranagar", "Koramangala", "Whitefield", "HSR Layout", "Jayanagar",
    "Banashankari", "Electronic City", "Marathahalli", "JP Nagar", "BTM Layout"
]

ROAD_TEMPLATES = [
    ("Potholes causing traffic in {area}", "Multiple potholes on the main road in {area} are causing congestion and minor vehicle damage during peak hours."),
    ("Damaged road surface near {area} signal", "The road surface near {area} signal has broken edges and uneven patches, making two-wheeler travel unsafe."),
    ("Urgent repair needed on {area} internal road", "Residents in {area} report that the internal road has cracks and loose gravel and needs immediate resurfacing.")
]

WATER_TEMPLATES = [
    ("Low water pressure in {area}", "Households in {area} are receiving very low water pressure in the morning supply window, affecting daily usage."),
    ("Irregular water supply timing in {area}", "Water supply has become inconsistent in {area}, with delayed timing over the last three days."),
    ("Leakage reported on pipeline near {area}", "A visible pipeline leak near {area} is wasting water and reducing supply to nearby lanes.")
]

ELECTRICITY_TEMPLATES = [
    ("Frequent power cuts in {area}", "There have been repeated unannounced power cuts in {area} since evening, affecting homes and shops."),
    ("Streetlight outage on {area} main road", "Several streetlights on the main road in {area} are not working, raising safety concerns at night."),
    ("Voltage fluctuation complaint from {area}", "Residents in {area} are experiencing voltage fluctuations that may damage appliances.")
]

GARBAGE_TEMPLATES = [
    ("Garbage collection skipped in {area}", "Door-to-door garbage collection was missed in parts of {area} for two days, causing overflow in bins."),
    ("Waste pileup near market in {area}", "A waste pileup near the market area in {area} is causing foul smell and attracting stray animals."),
    ("Segregated waste not being handled in {area}", "Residents report that segregated waste in {area} is being mixed during pickup and not processed correctly.")
]

SAFETY_TEMPLATES = [
    ("Dark stretch reported in {area}", "A poorly lit stretch in {area} is making late-evening travel unsafe for pedestrians."),
    ("Broken manhole cover in {area}", "A damaged manhole cover in {area} poses risk to motorists and pedestrians, especially at night."),
    ("Encroachment blocking footpath in {area}", "Illegal encroachment in {area} is blocking public footpaths and forcing people onto the road.")
]

TEMPLATES_BY_CATEGORY = {
    "road": ROAD_TEMPLATES,
    "water": WATER_TEMPLATES,
    "electricity": ELECTRICITY_TEMPLATES,
    "garbage": GARBAGE_TEMPLATES,
    "public-safety": SAFETY_TEMPLATES,
}

def random_location():
    # Bengaluru bounding box from your PDF
    lat = random.uniform(12.8, 13.2)
    lng = random.uniform(77.4, 77.8)
    return lng, lat


def random_address(area):
    return f"{random.randint(1, 250)}, {area} Main Road, Bengaluru, Karnataka"


def pick_complaint_content(category):
    area = random.choice(INDIAN_LOCALITIES)
    title_template, text_template = random.choice(TEMPLATES_BY_CATEGORY[category])
    return title_template.format(area=area), text_template.format(area=area), area

def seed_complaints(count=50):
    conn = get_connection()
    cur = conn.cursor()

    # Get user IDs
    cur.execute("SELECT id FROM users;")
    users = [row[0] for row in cur.fetchall()]

    categories = ["road", "water", "electricity", "garbage", "public-safety"]

    for _ in range(count):
        user_id = random.choice(users)
        category = random.choice(categories)
        title, text, area = pick_complaint_content(category)
        priority = round(random.random(), 2)
        sentiment = random.choice(["positive", "neutral", "negative"])
        sentiment_score = round(random.uniform(-1, 1), 2)

        lng, lat = random_location()
        status = random.choice(["open", "in_progress", "resolved"])
        address = random_address(area)

        cur.execute("""
            INSERT INTO complaints (
                user_id, title, text, category, priority,
                sentiment, sentiment_score, location_geometry,
                location_address, status, consent_given, consent_at
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                %s, %s, TRUE, NOW()
            );
        """, (user_id, title, text, category, priority,
              sentiment, sentiment_score, lng, lat,
              address, status))

    cur.close()
    conn.close()
    print(f"Seeded {count} complaints!")


if __name__ == "__main__":
    seed_complaints(100)
