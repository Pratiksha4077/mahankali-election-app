import os
import sys
import uuid
import datetime
from dotenv import load_dotenv
from pymongo import MongoClient
import psycopg2
from psycopg2.extras import execute_values

load_dotenv('backend/.env')
sys.stdout.reconfigure(encoding='utf-8')

mongo_url = os.getenv('MONGODB_URL')
mongo_client = MongoClient(mongo_url)
mongo_db = mongo_client[os.getenv('MONGODB_DB_NAME', 'election_db')]

pg_conn = psycopg2.connect(os.getenv('DATABASE_URL'))
pg_cur = pg_conn.cursor()

print("Connected to MongoDB and Supabase PostgreSQL successfully.")

SAKHARALE_ID = "11111111-1111-1111-1111-111111111111"

# 1. Clean existing members, uploaded_files, and old logs from Supabase
print("1. Cleaning old records from Supabase...")
pg_cur.execute("TRUNCATE TABLE public.activity_logs CASCADE;")
pg_cur.execute("TRUNCATE TABLE public.members CASCADE;")
pg_cur.execute("TRUNCATE TABLE public.import_jobs CASCADE;")
pg_cur.execute("TRUNCATE TABLE public.uploaded_files CASCADE;")
pg_cur.execute("TRUNCATE TABLE public.families CASCADE;")

# Keep only the 4 allowed users in Supabase
pg_cur.execute("DELETE FROM public.users WHERE username NOT IN ('karan', 'praji', 'admin', 'sush');")

# Keep only Sakharale in Supabase
pg_cur.execute("DELETE FROM public.villages WHERE id <> %s;", (SAKHARALE_ID,))
pg_conn.commit()
print("   Supabase tables cleared and prepared.")

# 2. Identify the Excel files from MongoDB
distinct_files = mongo_db.members.distinct('source.fileName')
print(f"2. Found {len(distinct_files)} uploaded Excel files in MongoDB: {distinct_files}")

file_id_map = {}
for fname in distinct_files:
    fname_str = fname or "imported_voters.xlsx"
    cnt = mongo_db.members.count_documents({'source.fileName': fname})
    f_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"file_{fname_str}"))
    file_id_map[fname_str] = f_uuid

    pg_cur.execute("""
        INSERT INTO public.uploaded_files (
            id, file_name, file_type, file_size, cloudinary_url, cloudinary_public_id,
            village_id, uploaded_by, total_records, imported_records, status, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (id) DO UPDATE SET
            total_records = EXCLUDED.total_records,
            imported_records = EXCLUDED.imported_records;
    """, (
        f_uuid,
        fname_str,
        "EXCEL",
        50000,
        f"https://res.cloudinary.com/c07yfemy/raw/upload/voters/{fname_str}",
        f"voters/{fname_str}",
        SAKHARALE_ID,
        "admin",
        cnt,
        cnt,
        "COMPLETED"
    ))
pg_conn.commit()
print("   Created uploaded_files entries in Supabase.")

# 3. Get Green category ID from Supabase
pg_cur.execute("SELECT id, code, color FROM public.categories WHERE code = 'GREEN' LIMIT 1;")
c_row = pg_cur.fetchone()
cat_id = c_row[0] if c_row else "11111111-1111-1111-1111-111111111112"
cat_code = "GREEN"
cat_color = "#10B981"

# 4. Prepare batch insert for all 4,124 members
docs = list(mongo_db.members.find({}))
print(f"3. Preparing batch insert for {len(docs)} members into Supabase public.members...")

insert_sql = """
INSERT INTO public.members (
    id, mongo_id, membership_number, epic_number, serial_number, booth_part_number,
    full_name, full_name_marathi, first_name, first_name_marathi,
    father_name, father_name_marathi, surname, surname_marathi,
    relation_type, relative_name_marathi, relative_name_english,
    house_number, age, gender, mobile_number, address, pin_code,
    village_id, village_name, village_name_marathi,
    category_id, category_code, category_color, status,
    source_file_id, source_file_name, source_file_type,
    created_at, updated_at, updated_by
) VALUES %s
ON CONFLICT (id) DO UPDATE SET
    full_name_marathi = EXCLUDED.full_name_marathi,
    first_name_marathi = EXCLUDED.first_name_marathi,
    surname_marathi = EXCLUDED.surname_marathi,
    father_name_marathi = EXCLUDED.father_name_marathi;
"""

rows = []
for doc in docs:
    mongo_id_str = str(doc.get("_id", ""))
    member_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"member_{mongo_id_str}"))

    membership_num = doc.get("membershipNumber") or ""
    epic_num = doc.get("epicNumber") or ""

    raw_serial = doc.get("serialNumber")
    try:
        serial_num = int(raw_serial) if raw_serial is not None else None
    except Exception:
        serial_num = None

    booth_part = str(doc.get("boothPartNumber") or "3")

    # Name extraction
    name_obj = doc.get("name") if isinstance(doc.get("name"), dict) else {}
    name_mr_obj = doc.get("nameMarathi") if isinstance(doc.get("nameMarathi"), dict) else {}

    full_name_mr = name_mr_obj.get("full") or doc.get("fullName") or "मतदार"
    full_name_en = name_obj.get("full") or full_name_mr

    first_name_mr = name_mr_obj.get("first") or ""
    surname_mr = name_mr_obj.get("surname") or ""
    father_name_mr = name_mr_obj.get("fatherName") or ""

    rel_obj = doc.get("relative") if isinstance(doc.get("relative"), dict) else {}
    rel_type = rel_obj.get("relationType") or "Father"
    rel_name_mr = rel_obj.get("nameMarathi") or father_name_mr or ""
    rel_name_en = rel_obj.get("nameEnglish") or ""

    house_num = str(doc.get("houseNumber") or "-")

    raw_age = doc.get("age")
    try:
        age = int(raw_age) if raw_age is not None else None
    except Exception:
        age = None

    gender = str(doc.get("gender") or "Male")
    if gender in ("पुरुष", "पु", "M", "m", "Male"):
        gender = "Male"
    elif gender in ("महिला", "स्त्री", "F", "f", "Female"):
        gender = "Female"

    mobile_num = str(doc.get("mobileNumber") or "")
    address = str(doc.get("address") or "")
    pin_code = str(doc.get("pinCode") or "415414")

    # Source file
    src_info = doc.get("source") if isinstance(doc.get("source"), dict) else {}
    src_file_name = src_info.get("fileName") or "59.xlsx"
    source_file_id = file_id_map.get(src_file_name)

    created_at = doc.get("createdAt") or datetime.datetime.now(datetime.timezone.utc)
    updated_at = doc.get("updatedAt") or datetime.datetime.now(datetime.timezone.utc)
    updated_by = str(doc.get("updatedBy") or "admin")

    row = (
        member_uuid,
        mongo_id_str,
        membership_num,
        epic_num,
        serial_num,
        booth_part,
        full_name_en,
        full_name_mr,
        first_name_mr,
        first_name_mr,
        father_name_mr,
        father_name_mr,
        surname_mr,
        surname_mr,
        rel_type,
        rel_name_mr,
        rel_name_en,
        house_num,
        age,
        gender,
        mobile_num,
        address,
        pin_code,
        SAKHARALE_ID,
        "Sakharale",
        "साखराळे",
        cat_id,
        cat_code,
        cat_color,
        "ACTIVE",
        source_file_id,
        src_file_name,
        "EXCEL",
        created_at,
        updated_at,
        updated_by
    )
    rows.append(row)

# 5. Insert in chunks
batch_size = 500
for i in range(0, len(rows), batch_size):
    batch = rows[i:i + batch_size]
    execute_values(pg_cur, insert_sql, batch)
    pg_conn.commit()
    print(f"   Inserted {min(i + batch_size, len(rows))} of {len(rows)} members into Supabase...")

# 6. Update Sakharale village counts
pg_cur.execute("""
    UPDATE public.villages
    SET total_voters = (SELECT count(*) FROM public.members WHERE village_id = %s),
        active_voters = (SELECT count(*) FROM public.members WHERE village_id = %s AND status = 'ACTIVE'),
        deceased_voters = 0,
        total_families = (SELECT count(*) FROM public.members WHERE village_id = %s) / 3,
        updated_at = NOW()
    WHERE id = %s;
""", (SAKHARALE_ID, SAKHARALE_ID, SAKHARALE_ID, SAKHARALE_ID))
pg_conn.commit()

# 7. Analyze
pg_cur.execute("ANALYZE public.members;")
pg_cur.execute("ANALYZE public.uploaded_files;")
pg_conn.commit()

# 8. Verify
pg_cur.execute("SELECT count(*) FROM public.members;")
cnt_members = pg_cur.fetchone()[0]

pg_cur.execute("SELECT count(*) FROM public.voters;")
cnt_voters = pg_cur.fetchone()[0]

pg_cur.execute("SELECT count(*) FROM public.uploaded_files;")
cnt_files = pg_cur.fetchone()[0]

pg_cur.execute("SELECT id, name, name_marathi, total_voters FROM public.villages;")
villages = pg_cur.fetchall()

pg_cur.execute("SELECT username, full_name FROM public.users;")
users = pg_cur.fetchall()

print("\n================ FINAL SUPABASE STATE ================")
print(f"Members in public.members: {cnt_members}")
print(f"Voters in public.voters (VIEW): {cnt_voters}")
print(f"Uploaded Files in public.uploaded_files: {cnt_files}")
print(f"Villages: {villages}")
print(f"Users: {users}")
print("======================================================")
