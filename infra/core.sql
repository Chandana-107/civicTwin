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
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('citizen', 'admin')),
    phone text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

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
