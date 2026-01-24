create table if not exists users (
    id uuid unique not null primary key,
    org_id uuid references organizations(id),
    email varchar unique,
    password_hash varchar,
    role varchar,
    invited_at timestamp default now(),
    joined_at timestamp,
    created_at timestamp default now()
)