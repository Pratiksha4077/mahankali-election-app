import psycopg2
import os

def run_migration():
    print("Reading supabase_migration.sql...")
    with open("supabase_migration.sql", "r", encoding="utf-8") as f:
        sql = f.read()

    db_url = "postgresql://postgres:C6gxtOI4FyxEGdmV@db.opjnrimmlguzpyaokvzb.supabase.co:5432/postgres"
    print("Connecting to Supabase PostgreSQL...")
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
