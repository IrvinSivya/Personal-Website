# Personal-Website

Irvin Sivya's personal website: [irvinsivya.com](https://www.irvinsivya.com/).

Flask + Jinja on Vercel, content in MongoDB. The site is a single page (`templates/index.html`)
with anchored sections; the old per-section URLs (`/projects`, `/accomplishments`, ...) redirect
to the matching anchor, and `/resume` opens the PDF in `static/`.

## Run locally

```bash
pip install -r requirements.txt
flask --app main run
```

`.env` needs `MONGO_URI` and `SECRET_KEY`. Do not run `python scripts/db_migrations_2026.py`
unless you mean to: it writes to the production database (it refuses without `--yes`).

## Content

- Projects, awards, experiences, skills, and extracurriculars come from MongoDB (`my_portfolio`).
- Hero, about, and the LibeCode experience entry are hardcoded in `templates/index.html`.
- Images live in `static/images/<collection>/` and are referenced by filename from the DB.
