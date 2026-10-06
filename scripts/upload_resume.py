"""
Upload the resume PDF that approved requests download (/resume/download/<token>).

The resume has a phone number and email on it, so it lives in MongoDB (`resume_files`), not in
static/ or this repo, both of which are public. Run this again whenever the resume changes:

    python scripts/upload_resume.py path/to/resume.pdf --yes

It writes to the production database, hence --yes. A warm serverless instance can keep serving
the previous PDF for up to five minutes (CACHE_TTL in main.py).
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

args = [a for a in sys.argv[1:] if a != "--yes"]
if len(args) != 1:
    print("Usage: python scripts/upload_resume.py path/to/resume.pdf --yes")
    sys.exit(1)
if "--yes" not in sys.argv:
    print("Refusing to run: this script writes to the production database. Pass --yes to confirm.")
    sys.exit(1)

with open(args[0], "rb") as f:
    data = f.read()
if not data.startswith(b"%PDF"):
    print(f"{args[0]} isn't a PDF.")
    sys.exit(1)

from bson import Binary  # noqa: E402
from main import resume_files_collection  # noqa: E402

resume_files_collection.replace_one(
    {"_id": "current"},
    {
        "_id": "current",
        "data": Binary(data),
        "filename": "Irvin_Sivya_Resume.pdf",
        "size": len(data),
        "uploaded_at": datetime.now(timezone.utc),
    },
    upsert=True,
)
print(f"Uploaded {args[0]} ({len(data) / 1024:.0f} KB) as the resume.")
