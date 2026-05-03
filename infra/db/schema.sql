--
-- PostgreSQL database dump
--


-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: aadhaar_otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aadhaar_otps (
    id integer NOT NULL,
    aadhaar_number character varying(12) NOT NULL,
    otp character varying(6) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT aadhaar_otps_aadhaar_number_check CHECK (((aadhaar_number)::text ~ '^[0-9]{12}$'::text))
);


--
-- Name: aadhaar_otps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aadhaar_otps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aadhaar_otps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aadhaar_otps_id_seq OWNED BY public.aadhaar_otps.id;


--
-- Name: aadhaar_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aadhaar_registry (
    id integer NOT NULL,
    aadhaar_number character varying(12) NOT NULL,
    full_name text NOT NULL,
    phone character varying(15) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT aadhaar_registry_aadhaar_number_check CHECK (((aadhaar_number)::text ~ '^[0-9]{12}$'::text)),
    CONSTRAINT aadhaar_registry_phone_check CHECK (((phone)::text ~ '^[+]?[0-9]{10,15}$'::text))
);


--
-- Name: aadhaar_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aadhaar_registry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aadhaar_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aadhaar_registry_id_seq OWNED BY public.aadhaar_registry.id;


--
-- Name: complaint_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complaint_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    complaint_id uuid,
    user_id uuid,
    note_type text,
    text text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT complaint_notes_note_type_check CHECK ((note_type = ANY (ARRAY['comment'::text, 'status_change'::text, 'assignment'::text])))
);


--
-- Name: complaints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complaints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title text NOT NULL,
    text text NOT NULL,
    category text,
    priority numeric,
    sentiment text,
    sentiment_score numeric,
    location_geometry public.geography(Point,4326),
    location_address text,
    attachment_url text,
    status text DEFAULT 'open'::text,
    assigned_to uuid,
    consent_given boolean DEFAULT false,
    consent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT complaints_priority_check CHECK (((priority >= (0)::numeric) AND (priority <= (1)::numeric))),
    CONSTRAINT complaints_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])))
);


--
-- Name: daily_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_topics (
    id integer NOT NULL,
    date date NOT NULL,
    topic text NOT NULL,
    category text,
    score numeric,
    occurrences integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: daily_topics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_topics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_topics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_topics_id_seq OWNED BY public.daily_topics.id;


--
-- Name: fraud_audit_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fraud_audit_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    summary jsonb,
    error_message text,
    CONSTRAINT fraud_audit_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: fraud_clusters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fraud_clusters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid,
    cluster_hash text,
    cluster_nodes jsonb NOT NULL,
    suspiciousness_score numeric,
    total_amount numeric,
    edge_density numeric,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fraud_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fraud_findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid,
    finding_key text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    finding_type text NOT NULL,
    severity text NOT NULL,
    risk_score numeric NOT NULL,
    anomaly_score numeric,
    graph_score numeric,
    title text NOT NULL,
    explanation text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    related_tender_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    related_cluster_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fraud_findings_risk_score_check CHECK (((risk_score >= (0)::numeric) AND (risk_score <= (100)::numeric))),
    CONSTRAINT fraud_findings_severity_check CHECK ((severity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text]))),
    CONSTRAINT fraud_findings_status_check CHECK ((status = ANY (ARRAY['open'::text, 'investigating'::text, 'escalated'::text, 'dismissed'::text, 'confirmed'::text])))
);


--
-- Name: labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labels (
    id integer NOT NULL,
    complaint_id uuid,
    labeled_by uuid,
    category text NOT NULL,
    priority numeric,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT labels_priority_check CHECK (((priority >= (0)::numeric) AND (priority <= (1)::numeric)))
);


--
-- Name: labels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.labels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: labels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.labels_id_seq OWNED BY public.labels.id;


--
-- Name: simulation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.simulation_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    params jsonb NOT NULL,
    status text DEFAULT 'queued'::text,
    result jsonb,
    error_message text,
    duration_seconds numeric,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT simulation_runs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: social_feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_feed (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    source_id text,
    text text NOT NULL,
    author text,
    sentiment text,
    sentiment_score numeric,
    location_geometry public.geography(Point,4326),
    posted_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    image_url text,
    posted_by uuid,
    post_background text
);


--
-- Name: social_post_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_post_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid,
    user_id uuid,
    comment_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: social_post_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_post_reactions (
    id bigint NOT NULL,
    post_id uuid,
    user_id uuid,
    reaction text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: social_post_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.social_post_reactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: social_post_reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.social_post_reactions_id_seq OWNED BY public.social_post_reactions.id;


--
-- Name: social_post_saves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_post_saves (
    id bigint NOT NULL,
    post_id uuid,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: social_post_saves_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.social_post_saves_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: social_post_saves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.social_post_saves_id_seq OWNED BY public.social_post_saves.id;


--
-- Name: tenders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tender_number text NOT NULL,
    title text NOT NULL,
    contractor text NOT NULL,
    contractor_id text,
    amount numeric NOT NULL,
    date date NOT NULL,
    category text,
    department text,
    beneficiary_id text,
    phone text,
    address text,
    death_date date,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tenders_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    aadhaar_number character varying(12) NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    phone text,
    is_aadhaar_verified boolean DEFAULT false,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_aadhaar_number_check CHECK (((aadhaar_number)::text ~ '^[0-9]{12}$'::text)),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['citizen'::text, 'admin'::text])))
);


--
-- Name: aadhaar_otps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aadhaar_otps ALTER COLUMN id SET DEFAULT nextval('public.aadhaar_otps_id_seq'::regclass);


--
-- Name: aadhaar_registry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aadhaar_registry ALTER COLUMN id SET DEFAULT nextval('public.aadhaar_registry_id_seq'::regclass);


--
-- Name: daily_topics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_topics ALTER COLUMN id SET DEFAULT nextval('public.daily_topics_id_seq'::regclass);


--
-- Name: labels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels ALTER COLUMN id SET DEFAULT nextval('public.labels_id_seq'::regclass);


--
-- Name: social_post_reactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_reactions ALTER COLUMN id SET DEFAULT nextval('public.social_post_reactions_id_seq'::regclass);


--
-- Name: social_post_saves id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_saves ALTER COLUMN id SET DEFAULT nextval('public.social_post_saves_id_seq'::regclass);


--
-- Name: aadhaar_otps aadhaar_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aadhaar_otps
    ADD CONSTRAINT aadhaar_otps_pkey PRIMARY KEY (id);


--
-- Name: aadhaar_registry aadhaar_registry_aadhaar_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aadhaar_registry
    ADD CONSTRAINT aadhaar_registry_aadhaar_number_key UNIQUE (aadhaar_number);


--
-- Name: aadhaar_registry aadhaar_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aadhaar_registry
    ADD CONSTRAINT aadhaar_registry_pkey PRIMARY KEY (id);


--
-- Name: complaint_notes complaint_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_notes
    ADD CONSTRAINT complaint_notes_pkey PRIMARY KEY (id);


--
-- Name: complaints complaints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_pkey PRIMARY KEY (id);


--
-- Name: daily_topics daily_topics_date_topic_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_topics
    ADD CONSTRAINT daily_topics_date_topic_category_key UNIQUE (date, topic, category);


--
-- Name: daily_topics daily_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_topics
    ADD CONSTRAINT daily_topics_pkey PRIMARY KEY (id);


--
-- Name: fraud_audit_runs fraud_audit_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_audit_runs
    ADD CONSTRAINT fraud_audit_runs_pkey PRIMARY KEY (id);


--
-- Name: fraud_clusters fraud_clusters_cluster_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_clusters
    ADD CONSTRAINT fraud_clusters_cluster_hash_key UNIQUE (cluster_hash);


--
-- Name: fraud_clusters fraud_clusters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_clusters
    ADD CONSTRAINT fraud_clusters_pkey PRIMARY KEY (id);


--
-- Name: fraud_findings fraud_findings_finding_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_findings
    ADD CONSTRAINT fraud_findings_finding_key_key UNIQUE (finding_key);


--
-- Name: fraud_findings fraud_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_findings
    ADD CONSTRAINT fraud_findings_pkey PRIMARY KEY (id);


--
-- Name: labels labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_pkey PRIMARY KEY (id);


--
-- Name: simulation_runs simulation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_runs
    ADD CONSTRAINT simulation_runs_pkey PRIMARY KEY (id);


--
-- Name: social_feed social_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_feed
    ADD CONSTRAINT social_feed_pkey PRIMARY KEY (id);


--
-- Name: social_post_comments social_post_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_comments
    ADD CONSTRAINT social_post_comments_pkey PRIMARY KEY (id);


--
-- Name: social_post_reactions social_post_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_reactions
    ADD CONSTRAINT social_post_reactions_pkey PRIMARY KEY (id);


--
-- Name: social_post_reactions social_post_reactions_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_reactions
    ADD CONSTRAINT social_post_reactions_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: social_post_saves social_post_saves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_saves
    ADD CONSTRAINT social_post_saves_pkey PRIMARY KEY (id);


--
-- Name: social_post_saves social_post_saves_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_saves
    ADD CONSTRAINT social_post_saves_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: tenders tenders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenders
    ADD CONSTRAINT tenders_pkey PRIMARY KEY (id);


--
-- Name: tenders tenders_tender_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenders
    ADD CONSTRAINT tenders_tender_number_key UNIQUE (tender_number);


--
-- Name: users users_aadhaar_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_aadhaar_number_key UNIQUE (aadhaar_number);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_aadhaar_registry_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aadhaar_registry_number ON public.aadhaar_registry USING btree (aadhaar_number);


--
-- Name: idx_complaints_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_complaints_category ON public.complaints USING btree (category);


--
-- Name: idx_complaints_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_complaints_created ON public.complaints USING btree (created_at DESC);


--
-- Name: idx_complaints_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_complaints_location ON public.complaints USING gist (location_geometry);


--
-- Name: idx_complaints_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_complaints_priority ON public.complaints USING btree (priority DESC);


--
-- Name: idx_complaints_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_complaints_status ON public.complaints USING btree (status);


--
-- Name: idx_complaints_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_complaints_user ON public.complaints USING btree (user_id);


--
-- Name: idx_fraud_clusters_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_clusters_run_id ON public.fraud_clusters USING btree (run_id);


--
-- Name: idx_fraud_clusters_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_clusters_score ON public.fraud_clusters USING btree (suspiciousness_score DESC);


--
-- Name: idx_fraud_findings_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_findings_entity ON public.fraud_findings USING btree (entity_type, entity_id);


--
-- Name: idx_fraud_findings_finding_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_findings_finding_type ON public.fraud_findings USING btree (finding_type);


--
-- Name: idx_fraud_findings_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_findings_run_id ON public.fraud_findings USING btree (run_id);


--
-- Name: idx_fraud_findings_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_findings_severity ON public.fraud_findings USING btree (severity);


--
-- Name: idx_fraud_findings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_findings_status ON public.fraud_findings USING btree (status);


--
-- Name: idx_fraud_findings_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_findings_updated_at ON public.fraud_findings USING btree (updated_at DESC);


--
-- Name: idx_fraud_runs_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_runs_started_at ON public.fraud_audit_runs USING btree (started_at DESC);


--
-- Name: idx_fraud_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_runs_status ON public.fraud_audit_runs USING btree (status);


--
-- Name: idx_labels_complaint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labels_complaint ON public.labels USING btree (complaint_id);


--
-- Name: idx_labels_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_labels_created ON public.labels USING btree (created_at DESC);


--
-- Name: idx_notes_complaint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_complaint ON public.complaint_notes USING btree (complaint_id, created_at DESC);


--
-- Name: idx_otp_aadhaar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_aadhaar ON public.aadhaar_otps USING btree (aadhaar_number);


--
-- Name: idx_otp_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_expiry ON public.aadhaar_otps USING btree (expires_at);


--
-- Name: idx_simulation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_created ON public.simulation_runs USING btree (created_at DESC);


--
-- Name: idx_simulation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_status ON public.simulation_runs USING btree (status);


--
-- Name: idx_simulation_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_simulation_user ON public.simulation_runs USING btree (user_id);


--
-- Name: idx_social_post_comments_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_post_comments_post_id ON public.social_post_comments USING btree (post_id, created_at DESC);


--
-- Name: idx_social_post_reactions_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_post_reactions_post_id ON public.social_post_reactions USING btree (post_id, created_at DESC);


--
-- Name: idx_social_post_saves_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_post_saves_post_id ON public.social_post_saves USING btree (post_id, created_at DESC);


--
-- Name: idx_social_posted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posted ON public.social_feed USING btree (posted_at DESC);


--
-- Name: idx_social_sentiment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_sentiment ON public.social_feed USING btree (sentiment);


--
-- Name: idx_tenders_beneficiary_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenders_beneficiary_id ON public.tenders USING btree (beneficiary_id);


--
-- Name: idx_tenders_contractor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenders_contractor ON public.tenders USING btree (contractor);


--
-- Name: idx_tenders_contractor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenders_contractor_id ON public.tenders USING btree (contractor_id);


--
-- Name: idx_tenders_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenders_date ON public.tenders USING btree (date);


--
-- Name: idx_tenders_death_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenders_death_date ON public.tenders USING btree (death_date) WHERE (death_date IS NOT NULL);


--
-- Name: idx_tenders_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenders_department ON public.tenders USING btree (department);


--
-- Name: idx_topics_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topics_date ON public.daily_topics USING btree (date DESC);


--
-- Name: idx_users_aadhaar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_aadhaar ON public.users USING btree (aadhaar_number);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: complaints update_complaints_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_complaints_updated_at BEFORE UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: complaint_notes complaint_notes_complaint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_notes
    ADD CONSTRAINT complaint_notes_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE CASCADE;


--
-- Name: complaint_notes complaint_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaint_notes
    ADD CONSTRAINT complaint_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: complaints complaints_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: complaints complaints_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complaints
    ADD CONSTRAINT complaints_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: aadhaar_otps fk_otp_aadhaar; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aadhaar_otps
    ADD CONSTRAINT fk_otp_aadhaar FOREIGN KEY (aadhaar_number) REFERENCES public.aadhaar_registry(aadhaar_number) ON DELETE CASCADE;


--
-- Name: fraud_clusters fraud_clusters_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_clusters
    ADD CONSTRAINT fraud_clusters_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.fraud_audit_runs(id) ON DELETE SET NULL;


--
-- Name: fraud_findings fraud_findings_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_findings
    ADD CONSTRAINT fraud_findings_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: fraud_findings fraud_findings_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fraud_findings
    ADD CONSTRAINT fraud_findings_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.fraud_audit_runs(id) ON DELETE CASCADE;


--
-- Name: labels labels_complaint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE CASCADE;


--
-- Name: labels labels_labeled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labels
    ADD CONSTRAINT labels_labeled_by_fkey FOREIGN KEY (labeled_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: simulation_runs simulation_runs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.simulation_runs
    ADD CONSTRAINT simulation_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: social_post_comments social_post_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_comments
    ADD CONSTRAINT social_post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_feed(id) ON DELETE CASCADE;


--
-- Name: social_post_comments social_post_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_comments
    ADD CONSTRAINT social_post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: social_post_reactions social_post_reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_reactions
    ADD CONSTRAINT social_post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_feed(id) ON DELETE CASCADE;


--
-- Name: social_post_reactions social_post_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_reactions
    ADD CONSTRAINT social_post_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: social_post_saves social_post_saves_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_saves
    ADD CONSTRAINT social_post_saves_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_feed(id) ON DELETE CASCADE;


--
-- Name: social_post_saves social_post_saves_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_post_saves
    ADD CONSTRAINT social_post_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


