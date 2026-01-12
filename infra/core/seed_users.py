# seed_users.py
from infra.db import get_connection
from faker import Faker
import bcrypt
import random

fake = Faker("en_IN")  # Indian locale for Aadhaar-style data

def generate_aadhaar():
    """Generate a valid 12-digit Aadhaar number as string"""
    return "".join([str(random.randint(0, 9)) for _ in range(12)])

def seed_users(count=20):
    conn = get_connection()
    cur = conn.cursor()

    for _ in range(count):
        name = fake.name()
        email = fake.unique.email()
        aadhaar_number = generate_aadhaar()
        password_hash = bcrypt.hashpw(
            "Password123!".encode(),
            bcrypt.gensalt()
        ).decode()
        role = random.choice(["citizen", "admin"])
        phone = fake.phone_number()
        is_aadhaar_verified = random.choice([True, False])

        cur.execute("""
            INSERT INTO users (
                name,
                aadhaar_number,
                email,
                password_hash,
                phone,
                is_aadhaar_verified,
                role
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s);
        """, (
            name,
            aadhaar_number,
            email,
            password_hash,
            phone,
            is_aadhaar_verified,
            role
        ))

    conn.commit()
    cur.close()
    conn.close()
    print(f"Seeded {count} users successfully!")

if __name__ == "__main__":
    seed_users(25)
