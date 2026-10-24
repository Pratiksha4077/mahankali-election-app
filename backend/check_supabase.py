import os
import psycopg2
from dotenv import load_dotenv

if os.path.exists('.env'):
    load_dotenv('.env')
else:
    load_dotenv('backend/.env')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

for table in ['villages', 'categories', 'users', 'families', 'voters', 'activity_logs', 'import_jobs', 'uploaded_files']:
    try:
        cur.execute(f"SELECT count(*) FROM public.{table};")
        cnt = cur.fetchone()[0]
        print(f"{table}: {cnt}")
    except Exception as e:
        print(f"{table}: error {e}")
        conn.rollback()

cur.execute("SELECT id, name, name_marathi FROM public.villages;")
print("\nVillages in Supabase:")
for r in cur.fetchall():
    print(" ", r)

cur.execute("SELECT id, code, name, name_marathi, color FROM public.categories;")
print("\nCategories in Supabase:")
for r in cur.fetchall():
    print(" ", r)

cur.execute("SELECT id, username, role FROM public.users;")
print("\nUsers in Supabase:")
for r in cur.fetchall():
    print(" ", r)
