# seed_tenders.py
from infra.db import get_connection
import random
import json
import uuid
from datetime import datetime, timedelta

INDIAN_CITIES = [
    "Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi",
    "Shivamogga", "Tumakuru", "Vijayapura", "Ballari", "Davanagere"
]

AREA_NAMES = [
    "Indiranagar", "Koramangala", "Whitefield", "HSR Layout", "Jayanagar",
    "Banashankari", "Electronic City", "Marathahalli", "JP Nagar", "BTM Layout"
]

CONTRACTORS = [
    "Shakti Infra Projects Pvt Ltd",
    "Namma Utility Services LLP",
    "SouthGrid Electrical Works",
    "Urban Axis Buildtech Pvt Ltd",
    "CivicRise Engineering Services",
    "Bharat Public Systems Ltd",
    "Pragati Maintenance Solutions",
    "Sahyadri Transport Infrastructure",
    "BlueRiver Watertech Services",
    "Annapurna Procurement Services"
]

TENDER_TITLES = {
    "Construction": [
        "Road resurfacing and pothole rectification in {area}",
        "Storm-water drain strengthening works in {area}",
        "Footpath redevelopment and curb alignment in {area}"
    ],
    "IT Services": [
        "Smart grievance dashboard implementation for {city} civic body",
        "Cloud migration and monitoring support for municipal data platform",
        "Annual maintenance of e-governance and complaint tracking modules"
    ],
    "Electrical": [
        "LED streetlight replacement and feeder upgrades in {area}",
        "Electrical safety audit and panel refurbishment for ward offices",
        "High-mast lighting installation at major junctions in {city}"
    ],
    "Maintenance": [
        "Desilting and routine drain maintenance in {area}",
        "Public toilet maintenance and sanitation services in {city}",
        "Ward-level park and median maintenance contract in {area}"
    ],
    "Transport": [
        "Bus shelter refurbishment and accessibility upgrades in {city}",
        "Traffic signal modernization at key intersections near {area}",
        "Road marking and signage improvement across urban corridors"
    ],
    "Supplies": [
        "Procurement of waste segregation bins for households in {city}",
        "Supply of water quality testing kits for zonal laboratories",
        "Purchase of emergency pumps and flood response equipment"
    ]
}

REMARKS = [
    "Tender follows standard procurement norms and service-level agreements.",
    "Vendor must comply with safety standards and environmental guidelines.",
    "Bid evaluation includes technical capability and past project delivery.",
    "Performance security and milestone-based billing will be applicable.",
    "Priority project due to frequent citizen complaints in the target area."
]

DOCUMENTS_BY_CATEGORY = {
    "Construction": ["BoQ.pdf", "Structural_Drawings.pdf", "Work_Scope.pdf"],
    "IT Services": ["RFP_IT_Platform.pdf", "SLA_Terms.pdf", "Architecture_Notes.pdf"],
    "Electrical": ["Electrical_Specs.pdf", "Safety_Compliance.pdf", "Bill_of_Materials.pdf"],
    "Maintenance": ["Maintenance_Schedule.pdf", "Service_Standards.pdf", "Inspection_Checklist.pdf"],
    "Transport": ["Traffic_Plan.pdf", "Signal_Design.pdf", "Route_Map.pdf"],
    "Supplies": ["Procurement_List.pdf", "Quality_Standards.pdf", "Delivery_Terms.pdf"]
}


def random_phone():
    return f"+91-{random.randint(60000, 99999)}{random.randint(10000, 99999)}"


def random_address(city, area):
    return f"{random.randint(1, 250)}, {area} Main Road, {city}, Karnataka"

def seed_tenders(count=40):
    conn = get_connection()
    cur = conn.cursor()

    categories = ["Construction", "IT Services", "Electrical", "Maintenance", "Transport", "Supplies"]
    departments = ["PWD", "Municipal", "Water Board", "Electricity Dept", "IT Dept", "Health Dept"]

    for _ in range(count):
        city = random.choice(INDIAN_CITIES)
        area = random.choice(AREA_NAMES)
        tender_number = f"TDR-{random.randint(10000, 99999)}"
        category = random.choice(categories)
        title_template = random.choice(TENDER_TITLES[category])
        title = title_template.format(city=city, area=area)
        contractor = random.choice(CONTRACTORS)
        contractor_id = str(uuid.uuid4())
        amount = round(random.uniform(50000, 50000000), 2)  # 50k – 5 crore
        
        # Random date from last 365 days
        date = (datetime.now() - timedelta(days=random.randint(0, 365))).date()

        department = random.choice(departments)
        beneficiary_id = str(uuid.uuid4())
        phone = random_phone()
        address = random_address(city, area)

        meta = {
            "city": city,
            "area": area,
            "remarks": random.choice(REMARKS),
            "documents": random.sample(DOCUMENTS_BY_CATEGORY[category], k=random.randint(1, 3)),
            "risk_score": round(random.uniform(0, 1), 3)
        }

        cur.execute("""
            INSERT INTO tenders (
                tender_number, title, contractor, contractor_id,
                amount, date, category, department,
                beneficiary_id, phone, address, meta
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            tender_number, title, contractor, contractor_id,
            amount, date, category, department,
            beneficiary_id, phone, address, json.dumps(meta)
        ))

    conn.commit()
    cur.close()
    conn.close()
    print(f"Seeded {count} tenders!")


if __name__ == "__main__":
    seed_tenders(50)
