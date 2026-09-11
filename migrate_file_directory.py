"""
One-time migration: create korda_file_directory from rag_state.db
Run: python migrate_file_directory.py
"""
import sqlite3
import hashlib
import json
import re
import os
import sys
import io
import time

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# --- Config ---
DB_PATH = r"C:\Users\s 30\Desktop\Кор\Кор АИ\База зананий на сервере\rag_state (2).db"
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
    "..", "RAG_Studio", "korda-syntax-firebase-adminsdk-fbsvc-956ed3c87d.json")

COLLECTION = "korda_file_directory"
BATCH_SIZE = 400

# Noise words to exclude from path keywords
PATH_NOISE = {'shares', 'openfolders', 'рабочие', 'папки', 'отдел', 'промышленного', 
              'пошива', 'база', 'лекал', 'new', 'base', 'расчеты', 'the', 'and', 'for'}


def extract_path_keywords(file_path):
    """Extract searchable keywords from file path + name."""
    text = file_path.lower()
    # Replace all non-letter/number chars with spaces
    text = re.sub(r'[^\w\s]', ' ', text, flags=re.UNICODE)
    words = text.split()
    # Filter: >= 2 chars, not noise, not drive letters
    keywords = []
    seen = set()
    for w in words:
        if len(w) >= 2 and w not in PATH_NOISE and w not in seen and not re.match(r'^[a-z]$', w):
            keywords.append(w)
            seen.add(w)
    return keywords[:150]


def make_file_id(file_hash, path):
    """Same hash as vectorizer.py _make_file_id."""
    path_hash = hashlib.sha256(path.encode('utf-8')).hexdigest()[:12]
    return f"{file_hash[:16]}_{path_hash}"


def main():
    # 1. Read paths from SQLite
    print(f"Reading from {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT original_path, file_hash FROM files")
    rows = cur.fetchall()
    conn.close()
    print(f"Found {len(rows)} files in rag_state.db")

    # 2. Init Firebase
    print("Connecting to Firebase...")
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        print("ERROR: firebase-admin not installed. Run: pip install firebase-admin")
        sys.exit(1)

    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print(f"ERROR: Service account not found at {SERVICE_ACCOUNT_PATH}")
        sys.exit(1)

    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase connected!")

    # 3. Batch write to Firestore
    start_time = time.time()
    written = 0
    errors = 0
    batch = db.batch()
    batch_count = 0

    for i, (path, file_hash) in enumerate(rows):
        try:
            filename = os.path.basename(path)
            file_type = os.path.splitext(path)[1].lower()
            file_id = make_file_id(file_hash or '', path)
            path_keywords = extract_path_keywords(path)

            doc_ref = db.collection(COLLECTION).document(file_id)
            batch.set(doc_ref, {
                'fileId': file_id,
                'filename': filename,
                'original_server_path': path,
                'file_type': file_type,
                'path_keywords': path_keywords,
                'total_chunks': 0,  # Unknown from SQLite
                'indexed_at': firestore.SERVER_TIMESTAMP
            })
            batch_count += 1

            if batch_count >= BATCH_SIZE:
                batch.commit()
                written += batch_count
                batch = db.batch()
                batch_count = 0

                elapsed = time.time() - start_time
                speed = written / max(elapsed, 1)
                remaining = (len(rows) - written) / max(speed, 1)
                eta = f"{remaining/60:.1f} min" if remaining > 60 else f"{remaining:.0f}s"
                print(f"\r  [{written}/{len(rows)}] {speed:.0f} files/sec, ETA: {eta}", end="", flush=True)

        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"\n  ERROR [{i}]: {str(e)[:80]}")

    # Commit remaining
    if batch_count > 0:
        batch.commit()
        written += batch_count

    total_time = time.time() - start_time
    print(f"\n\n{'='*50}")
    print(f"MIGRATION COMPLETE")
    print(f"Written: {written} file directory entries")
    print(f"Errors:  {errors}")
    print(f"Time:    {total_time:.1f}s ({written/max(total_time,1):.0f} files/sec)")
    print(f"{'='*50}")


if __name__ == '__main__':
    main()
