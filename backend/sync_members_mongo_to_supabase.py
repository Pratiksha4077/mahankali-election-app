import os
import uuid
import datetime
from pymongo import MongoClient
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv('backend/.env')

mongo_url = os.getenv('MONGODB_URL') or os.getenv('MONGO_URI')
mongo_client = MongoClient(mongo_url)
mongo_db = mongo_client[os.getenv('MONGODB_DB_NAME', 'election_db')]

pg_conn = psycopg2.connect(os.getenv('DATABASE_URL'))
pg_cur = pg_conn.cursor()

# Get existing village and category mappings from Supabase
pg_cur.execute("SELECT id, name, name_marathi FROM public.villages;")
villages = pg_cur.fetchall()
village_map = {}
default_village_id = None
for v_id, v_name, v_name_mr in villages:
    if not default_village_id:
        default_village_id = v_id
    village_map[v_name.lower()] = (v_id, v_name, v_name_mr)
    village_map[v_name_mr] = (v_id, v_name, v_name_mr)
    if "sakhar" in v_name.lower():
        village_map["sakharele"] = (v_id, v_name, v_name_mr)
        village_map["साखराळे"] = (v_id, v_name, v_name_mr)

pg_cur.execute("SELECT id, code, name, color FROM public.categories;")
categories = pg_cur.fetchall()
cat_map = {}
for c_id, c_code, c_name, c_color in categories:
    cat_map[c_code.upper()] = (c_id, c_code, c_color)
    cat_map[c_name.lower()] = (c_id, c_code, c_color)
    if "green" in c_code.lower() or "green" in c_name.lower():
        cat_map["green"] = (c_id, c_code, c_color)
        cat_map["light green"] = (c_id, c_code, c_color)

# Map category fallback
default_cat = cat_map.get("green", (categories[0][0], categories[0][1], categories[0][3]))

print(f"Found {mongo_db.members.count_documents({})} members in MongoDB.")

docs = list(mongo_db.members.find({}))
print(f"Loaded {len(docs)} documents from MongoDB. Preparing batch insert into Supabase...")

insert_sql = """
INSERT INTO public.members (
    id,
    mongo_id,
    membership_number,
    epic_number,
    serial_number,
    booth_part_number,
    full_name,
    full_name_marathi,
    first_name,
    first_name_marathi,
    father_name,
    father_name_marathi,
    surname,
    surname_marathi,
    relation_type,
    relative_name_marathi,
    relative_name_english,
    house_number,
    age,
    gender,
    mobile_number,
    address,
    pin_code,
    religion,
    caste,
    profession,
    designation,
    village_id,
    village_name,
    village_name_marathi,
    category_id,
    category_code,
    category_color,
    status,
    source_file_name,
    source_file_type,
    created_at,
    updated_at,
    updated_by
) VALUES %s
ON CONFLICT (id) DO UPDATE SET
    mongo_id = EXCLUDED.mongo_id,
    membership_number = EXCLUDED.membership_number,
    epic_number = EXCLUDED.epic_number,
    serial_number = EXCLUDED.serial_number,
    booth_part_number = EXCLUDED.booth_part_number,
    full_name = EXCLUDED.full_name,
    full_name_marathi = EXCLUDED.full_name_marathi,
    first_name = EXCLUDED.first_name,
    first_name_marathi = EXCLUDED.first_name_marathi,
    father_name = EXCLUDED.father_name,
    father_name_marathi = EXCLUDED.father_name_marathi,
    surname = EXCLUDED.surname,
    surname_marathi = EXCLUDED.surname_marathi,
    relation_type = EXCLUDED.relation_type,
    relative_name_marathi = EXCLUDED.relative_name_marathi,
    relative_name_english = EXCLUDED.relative_name_english,
    house_number = EXCLUDED.house_number,
    age = EXCLUDED.age,
    gender = EXCLUDED.gender,
    mobile_number = EXCLUDED.mobile_number,
    address = EXCLUDED.address,
    pin_code = EXCLUDED.pin_code,
    religion = EXCLUDED.religion,
    caste = EXCLUDED.caste,
    profession = EXCLUDED.profession,
    designation = EXCLUDED.designation,
    village_id = EXCLUDED.village_id,
    village_name = EXCLUDED.village_name,
    village_name_marathi = EXCLUDED.village_name_marathi,
    category_id = EXCLUDED.category_id,
    category_code = EXCLUDED.category_code,
    category_color = EXCLUDED.category_color,
    status = EXCLUDED.status,
    source_file_name = EXCLUDED.source_file_name,
    source_file_type = EXCLUDED.source_file_type,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;
"""

rows = []
for doc in docs:
    mongo_id_str = str(doc.get("_id", ""))
    # Deterministic UUID based on mongo_id
    member_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"member_{mongo_id_str}"))

    membership_num = doc.get("membershipNumber") or ""
    epic_num = doc.get("epicNumber") or ""
    
    raw_serial = doc.get("serialNumber")
    try:
        serial_num = int(raw_serial) if raw_serial is not None else None
    except Exception:
        serial_num = None

    booth_part = str(doc.get("boothPartNumber") or "3")

    # Name English
    name_obj = doc.get("name") if isinstance(doc.get("name"), dict) else {}
    full_name = name_obj.get("full") or doc.get("fullName") or ""
    first_name = name_obj.get("first") or ""
    surname = doc.get("surname") or name_obj.get("surname") or ""
    father_name = name_obj.get("fatherName") or ""

    # Name Marathi
    name_mr_obj = doc.get("nameMarathi") if isinstance(doc.get("nameMarathi"), dict) else {}
    full_name_mr = name_mr_obj.get("full") or full_name or "मतदार"
    first_name_mr = name_mr_obj.get("first") or ""
    surname_mr = name_mr_obj.get("surname") or surname or ""
    father_name_mr = name_mr_obj.get("fatherName") or ""

    # Relative
    rel_obj = doc.get("relative") if isinstance(doc.get("relative"), dict) else {}
    rel_type = rel_obj.get("relationType") or "Father"
    rel_name_mr = rel_obj.get("nameMarathi") or father_name_mr or ""
    rel_name_en = rel_obj.get("nameEnglish") or father_name or ""

    house_num = str(doc.get("houseNumber") or "-")
    
    raw_age = doc.get("age")
    try:
        age = int(raw_age) if raw_age is not None else None
    except Exception:
        age = None

    gender = str(doc.get("gender") or "Male")
    mobile_num = str(doc.get("mobileNumber") or "")
    address = str(doc.get("address") or "")
    pin_code = str(doc.get("pinCode") or "415414")
    religion = str(doc.get("religion") or "")
    caste = str(doc.get("caste") or "")
    profession = str(doc.get("profession") or "")
    designation = str(doc.get("designation") or "Member")

    # Village lookup
    v_info = doc.get("village") if isinstance(doc.get("village"), dict) else {}
    v_name = v_info.get("name", "")
    v_name_mr = v_info.get("nameMarathi", "")
    matched_village = village_map.get(v_name.lower()) or village_map.get(v_name_mr) or (default_village_id, "Sakharale", "साखराळे")
    village_id, resolved_v_name, resolved_v_name_mr = matched_village

    # Category lookup
    c_info = doc.get("category") if isinstance(doc.get("category"), dict) else {}
    c_name = str(c_info.get("name", "")).lower()
    c_color = c_info.get("color", "")
    matched_cat = cat_map.get(c_name) or default_cat
    cat_id, cat_code, cat_color = matched_cat

    status = str(doc.get("status") or "ACTIVE")

    # Source
    src_info = doc.get("source") if isinstance(doc.get("source"), dict) else {}
    src_file_name = src_info.get("fileName") or "62_voters.xlsx"
    src_file_type = src_info.get("fileType") or "EXCEL"

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
        full_name,
        full_name_mr,
        first_name,
        first_name_mr,
        father_name,
        father_name_mr,
        surname,
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
        religion,
        caste,
        profession,
        designation,
        village_id,
        resolved_v_name,
        resolved_v_name_mr,
        cat_id,
        cat_code,
        cat_color,
        status,
        src_file_name,
        src_file_type,
        created_at,
        updated_at,
        updated_by
    )
    rows.append(row)

# Batch insert in chunks of 500
batch_size = 500
for i in range(0, len(rows), batch_size):
    batch = rows[i:i + batch_size]
    execute_values(pg_cur, insert_sql, batch)
    pg_conn.commit()
    print(f"Inserted batch {i + 1} to {min(i + batch_size, len(rows))} of {len(rows)}")

# Update village counts
pg_cur.execute("""
UPDATE public.villages
SET 
    total_voters = (SELECT count(*) FROM public.members WHERE village_id = public.villages.id AND is_deleted = false),
    active_voters = (SELECT count(*) FROM public.members WHERE village_id = public.villages.id AND status = 'ACTIVE' AND is_deleted = false),
    deceased_voters = (SELECT count(*) FROM public.members WHERE village_id = public.villages.id AND status = 'DECEASED' AND is_deleted = false);
""")
pg_conn.commit()

# Run ANALYZE so that pg_class statistics and Supabase Studio Estimated Rows show the exact count!
pg_cur.execute("ANALYZE public.members;")
pg_conn.commit()

# Verify counts in Supabase
pg_cur.execute("SELECT count(*) FROM public.members;")
total_in_supabase = pg_cur.fetchone()[0]

pg_cur.execute("SELECT count(*) FROM public.voters;")
total_in_voters_view = pg_cur.fetchone()[0]

print(f"\n==========================================")
print(f"SUCCESS: Supabase public.members now has {total_in_supabase} rows!")
print(f"SUCCESS: Supabase public.voters (view) now has {total_in_voters_view} rows!")
print(f"==========================================")
