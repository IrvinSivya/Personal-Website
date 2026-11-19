# Personal-Website

Irvin Sivya's personal website: [irvinsivya.com](https://www.irvinsivya.com/).

Flask + Jinja on Vercel. The home page is a single page (`templates/index.html`) laid out as four
doors around a name card: Robotics, Hackathons, Awards + achievements and LibeCode. Each door is a
faded photo collage (`static/images/home/`) that returns to colour on hover and opens a popup
(`<dialog id="...">`). `static/js/home.js` opens the popups and keeps the URL hash in step, so
`/#robotics` style links and the old per-section URLs land on the right popup. Styles for the
page are in `static/css/home.css`; `static/css/style.css` still carries the reset, the intro and
the resume pages. A black-and-white globe intro (`static/js/intro.js`) plays once per session first.
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

- The home page and its four popups are written by hand in `templates/index.html`, so the page
  renders without a database round trip.
- MongoDB (`my_portfolio`) still holds the resume requests and the resume file. The older
  collections (projects, awards, experiences, skills, extracurriculars) and their helpers in
  `main.py` are no longer read by the home page.
- Images live in `static/images/`; the door collages and the portrait are in `static/images/home/`.

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
