-- Add organization_id to change_events table
ALTER TABLE change_events 
ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for organization_id
CREATE INDEX IF NOT EXISTS idx_change_events_organization_id ON change_events(organization_id);

-- For existing data, we'll need to handle this in the application
-- In a real migration, you might want to set a default organization or handle existing data differently