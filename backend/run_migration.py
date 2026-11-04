import psycopg2
import os
import sys
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')
if os.path.exists('.env'):
    load_dotenv('.env')
else:
    load_dotenv('backend/.env')

def run_migration():
    print("Reading supabase_migration.sql...")
    sql_path = "supabase_migration.sql" if os.path.exists("supabase_migration.sql") else "backend/supabase_migration.sql"
    with open(sql_path, "r", encoding="utf-8") as f:
        sql = f.read()

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not found in environment!")
    print(f"Connecting to Supabase PostgreSQL at {db_url.split('@')[-1]}...")
    conn = psycopg2.connect(db_url, connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()

    print("Executing SQL migration script...")
    cur.execute(sql)
    print("Migration SQL executed successfully!")

    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;")
    tables = [r[0] for r in cur.fetchall()]
    print("Tables in public schema:", tables)

    cur.execute("SELECT count(*) FROM public.users;")
    print("Users count:", cur.fetchone()[0])

    cur.execute("SELECT count(*) FROM public.villages;")
    print("Villages count:", cur.fetchone()[0])

    cur.execute("SELECT count(*) FROM public.categories;")
    print("Categories count:", cur.fetchone()[0])

    cur.close()
    conn.close()

if __name__ == "__main__":
    run_migration()
