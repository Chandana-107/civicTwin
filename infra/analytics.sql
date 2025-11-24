-- Simulation runs: stores ABM simulation metadata and results
CREATE TABLE simulation_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 params jsonb NOT NULL, -- Input parameters
 status text DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
 result jsonb, -- Output metrics
 error_message text,
 duration_seconds numeric,
 created_at timestamptz DEFAULT now(),
 started_at timestamptz,
 completed_at timestamptz
);
CREATE INDEX idx_simulation_user ON simulation_runs(user_id);
CREATE INDEX idx_simulation_status ON simulation_runs(status);
CREATE INDEX idx_simulation_created ON simulation_runs(created_at DESC);
-- Daily topics: aggregated keyword/topic extraction
CREATE TABLE daily_topics (
 id serial PRIMARY KEY,
 date date NOT NULL,
 topic text NOT NULL,
 category text,
 score numeric,
 occurrences integer,
 created_at timestamptz DEFAULT now(),
 UNIQUE(date, topic, category)
);
CREATE INDEX idx_topics_date ON daily_topics(date DESC);
-- Social feed: stores social media posts for sentiment analysis
CREATE TABLE social_feed (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source text NOT NULL, -- 'twitter', 'facebook', etc.
 source_id text,
 text text NOT NULL,
 author text,
 sentiment text,
 sentiment_score numeric,
 location_geometry geography(point, 4326),
 posted_at timestamptz NOT NULL,
 created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_social_posted ON social_feed(posted_at DESC);
CREATE INDEX idx_social_sentiment ON social_feed(sentiment);

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
 NEW.updated_at = now();
 RETURN NEW;
END;
$$ language 'plpgsql';
-- Apply trigger to relevant tables