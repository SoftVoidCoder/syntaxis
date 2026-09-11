import hashlib, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Check what fileId would be for these files
files = [
    ("D:/shares/OPENFOLDERS/Рабочие папки/Отдел промышленного пошива/!Расчеты\\100\\100899\\100899.xlsm", ""),
    ("D:/shares/OPENFOLDERS/Рабочие папки/Отдел промышленного пошива/!Расчеты\\100\\100899\\тз\\ТЕХНИЧЕСКОЕ ЗАДАНИЕ - проект.pdf", ""),
]

import sqlite3
db_path = r"C:\Users\s 30\Desktop\Кор\Кор АИ\База зананий на сервере\rag_state (2).db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT original_path, file_hash FROM files WHERE original_path LIKE '%100899%'")
rows = cur.fetchall()

for path, file_hash in rows:
    path_hash = hashlib.sha256(path.encode('utf-8')).hexdigest()[:12]
    file_id = f"{file_hash[:16]}_{path_hash}"
    print(f"Path: {path}")
    print(f"  file_hash: {file_hash[:20]}...")
    print(f"  file_id:   {file_id}")
    
    # What keywords would be extracted
    import re
    PATH_NOISE = {'shares', 'openfolders', 'рабочие', 'папки', 'отдел', 'промышленного', 
                  'пошива', 'база', 'лекал', 'new', 'base', 'расчеты', 'the', 'and', 'for'}
    text = path.lower()
    text = re.sub(r'[^\w\s]', ' ', text, flags=re.UNICODE)
    words = text.split()
    keywords = []
    seen = set()
    for w in words:
        if len(w) >= 2 and w not in PATH_NOISE and w not in seen and not re.match(r'^[a-z]$', w):
            keywords.append(w)
            seen.add(w)
    print(f"  path_keywords: {keywords}")
    print()

conn.close()
