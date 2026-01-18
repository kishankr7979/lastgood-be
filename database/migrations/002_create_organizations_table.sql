-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- optional but very useful later
    slug TEXT UNIQUE,
    -- metadata / plan info (future-safe)
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Create index on plan for filtering
CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations(plan);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraint to ensure slug is lowercase and URL-friendly
ALTER TABLE organizations 
ADD CONSTRAINT organizations_slug_format 
CHECK (slug ~ '^[a-z0-9-]+$' OR slug IS NULL);

-- Add constraint for valid plan values
ALTER TABLE organizations 
ADD CONSTRAINT organizations_plan_valid 
CHECK (plan IN ('free', 'starter', 'pro', 'enterprise'));