# seed_tenders.py
from infra.db import get_connection
from faker import Faker
import random
import json
from datetime import datetime, timedelta

fake = Faker("en_IN")

def seed_tenders(count=40):
    conn = get_connection()
    cur = conn.cursor()

    categories = ["Construction", "IT Services", "Electrical", "Maintenance", "Transport", "Supplies"]
    departments = ["PWD", "Municipal", "Water Board", "Electricity Dept", "IT Dept", "Health Dept"]

    for _ in range(count):
        tender_number = f"TDR-{random.randint(10000, 99999)}"
        title = fake.sentence(nb_words=5)
        contractor = fake.company()
        contractor_id = fake.uuid4()
        amount = round(random.uniform(50000, 50000000), 2)  # 50k – 5 crore
        
        # Random date from last 365 days
        date = (datetime.now() - timedelta(days=random.randint(0, 365))).date()

        category = random.choice(categories)
        department = random.choice(departments)
        beneficiary_id = fake.uuid4()
        phone = fake.phone_number()
        address = fake.address()

        meta = {
            "remarks": fake.sentence(),
            "documents": [fake.file_name() for _ in range(random.randint(1, 3))],
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
