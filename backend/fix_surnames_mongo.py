import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

load_dotenv('backend/.env')
sys.stdout.reconfigure(encoding='utf-8')

client = MongoClient(os.getenv('MONGODB_URL'))
db = client[os.getenv('MONGODB_DB_NAME')]

total_docs = db.members.count_documents({})
print(f"Total documents in members collection: {total_docs}")

updates = []
for doc in db.members.find({}):
    full_name = doc.get('nameMarathi', {}).get('full') or doc.get('name', {}).get('full') or ''
    parts = full_name.strip().split()
    if len(parts) >= 2:
        first = parts[0]
        surname = parts[-1]
        father = ' '.join(parts[1:-1]) if len(parts) >= 3 else ''
        updates.append(UpdateOne(
            {'_id': doc['_id']},
            {'$set': {
                'nameMarathi.first': first,
                'nameMarathi.surname': surname,
                'nameMarathi.fatherName': father,
                'name.first': first,
                'name.surname': surname,
                'name.fatherName': father
            }}
        ))

print(f"Prepared {len(updates)} surname updates.")
if updates:
    CHUNK_SIZE = 1000
    modified = 0
    for i in range(0, len(updates), CHUNK_SIZE):
        chunk = updates[i:i + CHUNK_SIZE]
        res = db.members.bulk_write(chunk, ordered=False)
        modified += res.modified_count
        print(f"Updated chunk {i} to {i + len(chunk)} (modified: {res.modified_count})")
    print(f"Successfully updated surnames for {modified} members in MongoDB!")

# Verify top surnames now:
pipeline = [
    {'$match': {'status': 'ACTIVE', 'nameMarathi.surname': {'$nin': ['', None, '-']}}},
    {'$group': {'_id': '$nameMarathi.surname', 'count': {'$sum': 1}}},
    {'$sort': {'count': -1}},
    {'$limit': 10}
]
print("\nTop 10 Surnames in MongoDB after update:")
for row in db.members.aggregate(pipeline):
    print(f"  {row['_id']}: {row['count']}")
