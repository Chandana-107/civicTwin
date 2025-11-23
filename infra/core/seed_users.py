# seed_users.py
from infra.db import get_connection
from faker import Faker
import bcrypt
import random

fake = Faker()

def seed_users(count=20):
    conn = get_connection()
    cur = conn.cursor()

    for _ in range(count):
        name = fake.name()
        email = fake.unique.email()
        password_hash = bcrypt.hashpw("Password123!".encode(), bcrypt.gensalt()).decode()
        role = random.choice(["citizen", "admin"])
        phone = fake.phone_number()

        cur.execute("""
            INSERT INTO users (name, email, password_hash, role, phone)
            VALUES (%s, %s, %s, %s, %s);
        """, (name, email, password_hash, role, phone))

    cur.close()
    conn.close()
    print(f"Seeded {count} users!")


if __name__ == "__main__":
    seed_users(25)
