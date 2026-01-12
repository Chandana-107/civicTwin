-- ======================================================
-- core.sql
-- Core schema for Users, Complaints, Labels, Complaint Notes
-- ======================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

-- Set timezone standard
SET timezone = 'UTC';

----------------------------------------------------------
-- USERS TABLE
----------------------------------------------------------
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    -- Aadhaar integration
    aadhaar_number VARCHAR(12) UNIQUE NOT NULL CHECK (aadhaar_number ~ '^[0-9]{12}$'),
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    phone text,
    is_aadhaar_verified BOOLEAN DEFAULT FALSE,
    role text NOT NULL CHECK (role IN ('citizen', 'admin')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_aadhaar ON users(aadhaar_number);
CREATE INDEX idx_users_role ON users(role);

----------------------------------------------------------
-- AADHAAR REGISTRY TABLE
----------------------------------------------------------
CREATE TABLE IF NOT EXISTS aadhaar_registry (
    id SERIAL PRIMARY KEY,
    aadhaar_number VARCHAR(12) UNIQUE NOT NULL CHECK (aadhaar_number ~ '^[0-9]{12}$'),
    full_name TEXT NOT NULL,
    phone VARCHAR(15) NOT NULL CHECK (phone ~ '^[+]?[0-9]{10,15}$'),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX idx_aadhaar_registry_number ON aadhaar_registry(aadhaar_number);

----------------------------------------------------------
-- AADHAAR OTP TABLE
----------------------------------------------------------
CREATE TABLE IF NOT EXISTS aadhaar_otps (
    id SERIAL PRIMARY KEY,
    aadhaar_number VARCHAR(12) NOT NULL CHECK (aadhaar_number ~ '^[0-9]{12}$'),
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_otp_aadhaar
        FOREIGN KEY (aadhaar_number)
        REFERENCES aadhaar_registry(aadhaar_number)
        ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_otp_aadhaar ON aadhaar_otps(aadhaar_number);
CREATE INDEX idx_otp_expiry ON aadhaar_otps(expires_at);

----------------------------------------------------------
-- COMPLAINTS TABLE
----------------------------------------------------------
CREATE TABLE complaints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    title text NOT NULL,
    text text NOT NULL,
    category text,
    priority numeric CHECK (priority >= 0 AND priority <= 1),
    sentiment text,
    sentiment_score numeric,
    location_geometry geography(point, 4326),
    location_address text,
    attachment_url text,
    status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
    consent_given boolean DEFAULT false,
    consent_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_complaints_user ON complaints(user_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_category ON complaints(category);
CREATE INDEX idx_complaints_created ON complaints(created_at DESC);
CREATE INDEX idx_complaints_priority ON complaints(priority DESC);
CREATE INDEX idx_complaints_location ON complaints USING GIST(location_geometry);

----------------------------------------------------------
-- LABELS TABLE
----------------------------------------------------------
CREATE TABLE labels (
    id serial PRIMARY KEY,
    complaint_id uuid REFERENCES complaints(id) ON DELETE CASCADE,
    labeled_by uuid REFERENCES users(id) ON DELETE SET NULL,
    category text NOT NULL,
    priority numeric CHECK (priority >= 0 AND priority <= 1),
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_labels_complaint ON labels(complaint_id);
CREATE INDEX idx_labels_created ON labels(created_at DESC);

----------------------------------------------------------
-- COMPLAINT NOTES TABLE
----------------------------------------------------------
CREATE TABLE complaint_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid REFERENCES complaints(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    note_type text CHECK (note_type IN ('comment', 'status_change', 'assignment')),
    text text NOT NULL,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

-- Index
CREATE INDEX idx_notes_complaint ON complaint_notes(complaint_id, created_at DESC);

----------------------------------------------------------
-- Trigger to update updated_at on changes
----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_complaints_updated_at
    BEFORE UPDATE ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
