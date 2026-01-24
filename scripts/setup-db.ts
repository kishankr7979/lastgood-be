import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import config from '../config/environment';

async function setupDatabase() {
    const client = new Client({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.name,
    });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        // Run migrations in order
        const migrations = [
            '001_create_change_events_table.sql',
            '002_create_organizations_table.sql',
            '003_create_api_keys_table.sql',
            '004_add_organization_id_to_change_events.sql'
        ];

        for (const migration of migrations) {
            const migrationPath = path.join(__dirname, `../database/migrations/${migration}`);
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

            await client.query(migrationSQL);
            console.log(`✅ Migration ${migration} executed successfully`);
        }

        // Run seeds in order
        const seeds = [
            'change_events.sql',
            'organizations.sql'
        ];

        for (const seed of seeds) {
            const seedPath = path.join(__dirname, `../database/seeds/${seed}`);
            const seedSQL = fs.readFileSync(seedPath, 'utf8');

            await client.query(seedSQL);
            console.log(`✅ Seed ${seed} executed successfully`);
        }

        console.log('🎉 Database setup completed!');
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

setupDatabase();