-- ============================================================
-- fraud.sql  —  CivicTwin Fraud Detection Schema (full reset)
-- Drop and recreate all fraud-related tables cleanly.
-- Run this to reset: psql $DATABASE_URL -f infra/fraud.sql
-- ============================================================

-- Drop in reverse-dependency order
DROP TABLE IF EXISTS fraud_findings   CASCADE;
DROP TABLE IF EXISTS fraud_clusters   CASCADE;
DROP TABLE IF EXISTS fraud_audit_runs CASCADE;
DROP TABLE IF EXISTS tenders          CASCADE;

-- ── tenders ──────────────────────────────────────────────────────────────────
-- Primary data table. Holds government contracts AND welfare disbursements.
-- The meta JSONB carries optional fields: bidder_count, execution_cost,
-- aadhaar_number, bank_account, beneficiary_name, beneficiary_status,
-- official_id, official_name, official_address, official_phone.
CREATE TABLE tenders (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_number  text        UNIQUE NOT NULL,
  title          text        NOT NULL,
  contractor     text        NOT NULL,
  contractor_id  text,
  amount         numeric     NOT NULL CHECK (amount > 0),
  date           date        NOT NULL,
  category       text,
  department     text,
  beneficiary_id text,
  phone          text,
  address        text,
  -- death_date: if set and any tender.date > death_date → post-death disbursement flag
  death_date     date,
  meta           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common pipeline queries
CREATE INDEX idx_tenders_date            ON tenders(date);
CREATE INDEX idx_tenders_contractor_id   ON tenders(contractor_id);
CREATE INDEX idx_tenders_contractor      ON tenders(contractor);
CREATE INDEX idx_tenders_beneficiary_id  ON tenders(beneficiary_id);
CREATE INDEX idx_tenders_department      ON tenders(department);
CREATE INDEX idx_tenders_death_date      ON tenders(death_date) WHERE death_date IS NOT NULL;

-- ── fraud_audit_runs ──────────────────────────────────────────────────────────
-- One row per pipeline execution. summary JSONB contains unified_report.
CREATE TABLE fraud_audit_runs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status        text        NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  summary       jsonb,
  error_message text
);

CREATE INDEX idx_fraud_runs_status     ON fraud_audit_runs(status);
CREATE INDEX idx_fraud_runs_started_at ON fraud_audit_runs(started_at DESC);

-- ── fraud_findings ────────────────────────────────────────────────────────────
-- One row per detected flag. finding_key ensures idempotent upserts.
-- severity must match riskLevel() output from fraudPipeline.js.
CREATE TABLE fraud_findings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              uuid        REFERENCES fraud_audit_runs(id) ON DELETE CASCADE,
  finding_key         text        NOT NULL UNIQUE,
  entity_type         text        NOT NULL,          -- contractor | beneficiary | department | tender
  entity_id           text        NOT NULL,
  finding_type        text        NOT NULL,          -- see DETECTION_TYPES in fraudReport.js
  severity            text        NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  risk_score          numeric     NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  anomaly_score       numeric,                       -- from ML isolation forest (nullable)
  graph_score         numeric,                       -- from ML graph service (nullable)
  title               text        NOT NULL,
  explanation         text        NOT NULL,
  evidence            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  related_tender_ids  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  related_cluster_ids jsonb       NOT NULL DEFAULT '[]'::jsonb,
  status              text        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open','investigating','escalated','dismissed','confirmed')),
  reviewed_by         uuid        REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fraud_findings_run_id      ON fraud_findings(run_id);
CREATE INDEX idx_fraud_findings_severity    ON fraud_findings(severity);
CREATE INDEX idx_fraud_findings_status      ON fraud_findings(status);
CREATE INDEX idx_fraud_findings_entity      ON fraud_findings(entity_type, entity_id);
CREATE INDEX idx_fraud_findings_finding_type ON fraud_findings(finding_type);
CREATE INDEX idx_fraud_findings_updated_at  ON fraud_findings(updated_at DESC);

-- ── fraud_clusters ────────────────────────────────────────────────────────────
-- Collusion clusters identified by the NetworkX graph service.
CREATE TABLE fraud_clusters (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id               uuid    REFERENCES fraud_audit_runs(id) ON DELETE SET NULL,
  cluster_hash         text    UNIQUE,
  cluster_nodes        jsonb   NOT NULL,
  suspiciousness_score numeric,
  total_amount         numeric,
  edge_density         numeric,
  evidence             jsonb   NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fraud_clusters_run_id ON fraud_clusters(run_id);
CREATE INDEX idx_fraud_clusters_score  ON fraud_clusters(suspiciousness_score DESC);
