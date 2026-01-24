-- Create change_events table
CREATE TABLE IF NOT EXISTS change_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    service VARCHAR(255) NOT NULL,
    environment VARCHAR(50) NOT NULL,
    type VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL,
    summary TEXT NOT NULL,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_change_events_occurred_at ON change_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_events_service ON change_events(service);
CREATE INDEX IF NOT EXISTS idx_change_events_environment ON change_events(environment);
CREATE INDEX IF NOT EXISTS idx_change_events_type ON change_events(type);
CREATE INDEX IF NOT EXISTS idx_change_events_source ON change_events(source);

-- Create GIN index for JSONB meta field for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_change_events_meta ON change_events USING GIN (meta);