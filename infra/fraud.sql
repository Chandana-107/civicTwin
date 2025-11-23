CREATE TABLE tenders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tender_number text UNIQUE NOT NULL,
 title text NOT NULL,
 contractor text NOT NULL,
 contractor_id text, -- For detecting repeat winners
 amount numeric NOT NULL CHECK (amount > 0),
 date date NOT NULL,
 category text,
 department text,
 beneficiary_id text, -- For detecting duplicate beneficiaries
 phone text,
 address text,
 meta jsonb, -- Additional flexible data
 created_at timestamptz DEFAULT now()
);


CREATE TABLE fraud_flags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tender_id uuid REFERENCES tenders(id) ON DELETE CASCADE,
 rule text NOT NULL, -- 'repeat_winner', 'price_outlier', etc.
 score numeric CHECK (score >= 0 AND score <= 1),
 evidence jsonb NOT NULL, -- Details about why flagged
 status text DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'confirmed', 'dismissed')),
 reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 created_at timestamptz DEFAULT now()
);


-- Fraud clusters: stores graph-based suspicious networks
CREATE TABLE fraud_clusters (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cluster_nodes jsonb NOT NULL, -- Array of node IDs in cluster
 suspiciousness_score numeric,
 total_amount numeric,
 edge_density numeric,
 evidence jsonb,
 created_at timestamptz DEFAULT now()
);


