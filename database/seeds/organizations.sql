-- Insert sample organizations
INSERT INTO organizations (id, name, slug, plan) VALUES 
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'Acme Corporation',
        'acme-corp',
        'enterprise'
    ),
    (
        'b2c3d4e5-f6g7-8901-bcde-f23456789012',
        'TechStart Inc',
        'techstart',
        'pro'
    ),
    (
        'c3d4e5f6-g7h8-9012-cdef-345678901234',
        'DevOps Solutions',
        'devops-solutions',
        'starter'
    ),
    (
        'd4e5f6g7-h8i9-0123-def0-456789012345',
        'Startup Labs',
        'startup-labs',
        'free'
    )
ON CONFLICT (id) DO NOTHING;