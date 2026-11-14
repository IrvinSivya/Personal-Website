# Personal-Website

Irvin Sivya's personal website: [irvinsivya.com](https://www.irvinsivya.com/).

Flask + Jinja on Vercel, content in MongoDB. The site is a single page (`templates/index.html`)
laid out as a node graph: a root node for Irvin, side nodes (experience, LibeCode, skills, beyond
code), four numbers under the root, and a node under each number for what backs it up (FRC hours →
robots, hackathon wins → projects, grad average → academics, scholarships → awards). Every node
opens a popup (`<dialog id="...">`); `static/js/script.js` draws the wires and opens popups from
`#id` links, so the old per-section URLs (`/projects`, `/accomplishments`, ...) still land on the
right popup. A black-and-white globe intro (`static/js/intro.js`) plays once per session first.
The resume is not public: see [Resume requests](#resume-requests).

## Run locally

```bash
pip install -r requirements.txt
flask --app main run
```

`.env` needs `MONGO_URI` and `SECRET_KEY` (plus the mail settings below to send resume
emails; set `SITE_URL=http://127.0.0.1:5000` locally so emailed links point at your machine). Do not run `python scripts/db_migrations_2026.py`
unless you mean to: it writes to the production database (it refuses without `--yes`).

## Content

- Projects, awards, experiences, skills, and extracurriculars come from MongoDB (`my_portfolio`).
- Hero, about, academics, and the LibeCode experience entry are hardcoded in `templates/index.html`.
- `build_graph()` in `main.py` sorts projects and awards into the nodes (FRC, hackathon wins,
  academic awards, everything else). A new document that matches nothing still appears in the
  general projects or awards popup.
- Images live in `static/images/<collection>/` and are referenced by filename from the DB.

## Resume requests

The resume has a phone number and email on it, so it is never in `static/` or in git (`*.pdf` is
ignored). Every Resume button opens a form (name, email, optional note):

1. The request is saved to `resume_requests` and Irvin gets an email with a review link.
2. The review page has Approve / Deny buttons. Approving emails the visitor a download link.
3. The download link works for 7 days and serves the PDF from `resume_files`. Revoking on the
   review page (or setting the request's `status` to `denied`) cuts it off early.

Upload or replace the PDF with `python scripts/upload_resume.py path/to/resume.pdf --yes`.

Environment variables (in Vercel and `.env`):

| Variable | Purpose |
| --- | --- |
| `SMTP_USER`, `SMTP_PASSWORD` | Mail login. For Gmail, the address and an [app password](https://myaccount.google.com/apppasswords). |
| `SMTP_HOST`, `SMTP_PORT` | Optional; default `smtp.gmail.com` and `465`. Any other port uses STARTTLS. |
| `MAIL_FROM` | Optional sender address; defaults to `SMTP_USER`. |
| `RESUME_NOTIFY_EMAIL` | Optional; where requests go. Defaults to `irvinsivya@gmail.com`. |
| `SITE_URL` | Optional base for emailed links; defaults to `https://www.irvinsivya.com`. |

`SECRET_KEY` signs the links, so changing it invalidates every outstanding one.
