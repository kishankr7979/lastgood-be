-- Insert sample change events
INSERT INTO change_events (id, occurred_at, service, environment, type, source, summary, meta) VALUES 
    (
        'b3c9e6f2-8d13-4c1a-9e52-7fd8a5a3c912',
        '2026-01-18T14:31:00Z',
        'api',
        'prod',
        'deployment',
        'github',
        'Deployed api@a8f3c2 by John',
        '{"commit": "a8f3c2", "author": "john"}'::jsonb
    ),
    (
        gen_random_uuid(),
        '2026-01-18T13:15:00Z',
        'web',
        'staging',
        'deployment',
        'github',
        'Deployed web@b7d4e1 by Jane',
        '{"commit": "b7d4e1", "author": "jane", "branch": "develop"}'::jsonb
    ),
    (
        gen_random_uuid(),
        '2026-01-18T12:00:00Z',
        'database',
        'prod',
        'migration',
        'manual',
        'Applied schema migration v2.1.0',
        '{"version": "2.1.0", "tables_affected": ["users", "orders"]}'::jsonb
    )
ON CONFLICT (id) DO NOTHING;