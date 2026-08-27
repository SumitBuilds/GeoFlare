import asyncio
import asyncpg
import os
import sys

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://geoflare_user:geoflare_password@127.0.0.1:5433/geoflare")

async def migrate():
    print("Starting migrations...")
    conn = await asyncpg.connect(DATABASE_URL)
    
    # Create migrations table if not exists
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Check if we already have the hotspots table from docker init
    has_legacy_tables = await conn.fetchval("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'hotspots'
        );
    """)

    if has_legacy_tables:
        # Retroactively mark the initial schema and seed as applied
        await conn.execute("INSERT INTO migrations (name) VALUES ('01_initial_schema') ON CONFLICT DO NOTHING")
        await conn.execute("INSERT INTO migrations (name) VALUES ('02_seed_data') ON CONFLICT DO NOTHING")

    try:
        # 01_initial_schema
        applied = await conn.fetchval("SELECT id FROM migrations WHERE name = '01_initial_schema'")
        if not applied:
            with open(os.path.join(os.path.dirname(__file__), "db/schema.sql"), "r") as f:
                sql = f.read()
            await conn.execute(sql)
            await conn.execute("INSERT INTO migrations (name) VALUES ('01_initial_schema')")
            print("Applied 01_initial_schema")
        else:
            print("01_initial_schema already applied.")
            
        # 02_seed_data
        seed_applied = await conn.fetchval("SELECT id FROM migrations WHERE name = '02_seed_data'")
        if not seed_applied:
            with open(os.path.join(os.path.dirname(__file__), "db/seed.sql"), "r") as f:
                sql = f.read()
            await conn.execute(sql)
            await conn.execute("INSERT INTO migrations (name) VALUES ('02_seed_data')")
            print("Applied 02_seed_data")
        else:
            print("02_seed_data already applied.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)
    finally:
        await conn.close()
    
    print("Migrations complete.")

if __name__ == "__main__":
    asyncio.run(migrate())
