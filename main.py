import mimetypes
import os
import re
import smtplib
import time
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from functools import wraps

from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, redirect, render_template, request, url_for
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from pymongo import MongoClient

load_dotenv()

# Windows' mimetype registry has no entry for .webp, so the dev server hands it
# out as application/octet-stream. Vercel's CDN gets this right on its own; this
# is only so local runs match production.
mimetypes.add_type("image/webp", ".webp")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

# Static files are fingerprint-free (CSS/JS carry ?v=ASSET_VERSION), so an hour keeps
# repeat visits off the network without making a change take a day to show up. In
# production Vercel serves /static from its CDN (see vercel.json); this only applies locally.
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 3600

# Timeouts matter here because this runs as a serverless function: without them a slow
# or unreachable Atlas node leaves the request hanging instead of failing fast (the page
# then renders with empty sections). connect=False defers the handshake off the import path.
MONGO_URI = os.environ.get("MONGO_URI")
client = MongoClient(
    MONGO_URI,
    connect=False,
    maxPoolSize=5,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=10000,
)

db = client.my_portfolio
skills_collection = db.skills
accomplishments_collection = db.accomplishments
projects_collection = db.projects
extra_curriculars_collection = db.extra_curriculars
experiences_collection = db.experiences
resume_requests_collection = db.resume_requests
resume_files_collection = db.resume_files

# Bump when CSS/JS change so Vercel's edge cache and browsers pick up the new files.
ASSET_VERSION = "2026.10.06"

# Every old page is now a section on the home page. Old URLs keep working via redirects.
SECTION_ANCHORS = {
    "projects": "projects",
    "accomplishments": "awards",
    "experiences": "experience",
    "skills": "skills",
    "extra_curriculars": "beyond",
}

# Logos and marks (as opposed to photos/screenshots). They render "contain" over a blurred
# backdrop instead of being cropped by object-fit: cover.
LOGO_IMAGES = {
    "LibeCodeLogo.png", "SalesPatriot.png", "ExpenseCity.jpg", "Intellisage.png", "rose.png",
    "skillswap.png", "allstar.png", "ap_scholar.png", "aws_certs.png", "csmc.webp",
    "codeninjas.png", "brampton.png",
}

# Short kicker shown above the featured projects.
PROJECT_KICKERS = {
    "LibeCode": "Now building · Co-founder & CTO",
    "2025 FRC Robot": "Lead programmer · FRC World Championship",
    "CrimeWatcher": "Machine learning · 474K police records",
    "OJuggle": "1st place · GDG Code the Cup",
    "LaunchScore": "2nd place · Daybot hackathon",
    "ExpenseCity": "2nd place · IBM Bobathon",
    "Project R.O.S.E.": "1st place · WolfHacks 2025",
    "SalesPatriot Logging Dashboard": "Internship · SalesPatriot (YC W25)",
    "IntelliSage": "Chrome extension · OpenAI API",
    "Student Skill Swap": "Hackathon · Innovative Hacks 2.0",
}

# Links that live in code rather than the database (override or fill in a project's `link`).
PROJECT_LINKS = {
    "LibeCode": ("https://libecode.com/", "libecode.com"),
}

SKILL_DISPLAY_NAMES = {"github": "GitHub", "flask": "Flask", "javascript": "JavaScript"}

LINKEDIN_URL = "https://www.linkedin.com/in/irvin-sivya/"


# ---------------------------------------------------------------------------
# Page data cache
#
# The content changes when a document is edited by hand, not per request, so every
# visitor was paying for the same Atlas round trips. Results are held in process for
# CACHE_TTL seconds; a warm serverless instance then renders with no database call at
# all. Empty results (a failed query) are never cached, so an outage heals on its own.
# ---------------------------------------------------------------------------

CACHE_TTL = 300
_cache = {}


def cached(key):
    def decorator(fn):
        @wraps(fn)
        def wrapper():
            hit = _cache.get(key)
            if hit and time.time() - hit[0] < CACHE_TTL:
                return hit[1]
            value = fn()
            if value:
                _cache[key] = (time.time(), value)
            return value
        return wrapper
    return decorator


def _fetch(collection):
    """One round trip per collection; if the database is unreachable, render the page
    without that section instead of a 500."""
    try:
        return list(collection.find())
    except Exception as exc:  # noqa: BLE001
        app.logger.error("database query failed: %s", exc)
        return []


# Each raster image under static/images is built with a .webp sibling. Templates only
# emit a <source> when one exists, because a <source> that 404s is not retried against
# the <img> - the image would just be missing. The listing is taken once at startup.
_WEBP_FILES = set()
for _dirpath, _dirnames, _filenames in os.walk(os.path.join(app.static_folder, "images")):
    for _name in _filenames:
        if _name.lower().endswith(".webp"):
            _rel = os.path.relpath(os.path.join(_dirpath, _name), app.static_folder)
            _WEBP_FILES.add(_rel.replace(os.sep, "/"))


@app.template_global()
def has_webp(static_path):
    return static_path in _WEBP_FILES


def _link_label(url):
    u = (url or "").lower()
    if "youtube" in u or "youtu.be" in u:
        return "Watch"
    if "devpost" in u:
        return "Devpost"
    return "Live"


@cached("projects")
def get_projects():
    everything = _fetch(projects_collection)

    # Identify the 2025 FRC robot project by its image so we don't depend on its exact
    # title. If not found, the order falls back to LibeCode, CrimeWatcher, OJuggle.
    robot = next((p for p in everything if p.get("image") == "2025_robot.webp"), None)
    featured_titles = ["LibeCode"]
    if robot:
        featured_titles.append(robot["title"])
    featured_titles += ["CrimeWatcher", "OJuggle"]

    by_title = {}
    for p in everything:
        by_title.setdefault(p.get("title"), []).append(p)
    featured = []
    for title in featured_titles:
        featured += by_title.get(title, [])
    rest = [p for p in everything if p.get("title") not in featured_titles]

    projects = featured + rest
    for i, p in enumerate(projects):
        p["index"] = i + 1
        p["is_logo"] = p.get("image") in LOGO_IMAGES
        p["kicker"] = PROJECT_KICKERS.get(p.get("title", ""), (p.get("tech") or "").split(",")[0])
        p["tech_list"] = [t.strip() for t in (p.get("tech") or "").split(",") if t.strip()]
        override = PROJECT_LINKS.get(p.get("title", ""))
        if override:
            p["link"], p["link_label"] = override
        else:
            p["link_label"] = _link_label(p.get("link"))
        # A stale placeholder in the DB points this project's GitHub link at this website's
        # own repo; hide it rather than send recruiters somewhere irrelevant.
        if (p.get("github") or "").rstrip("/").endswith("IrvinSivya/Personal-Website"):
            p["github"] = None
    return projects


@cached("awards")
def get_awards():
    # Pinned awards (those with a 'priority') render first in ascending order; the rest follow.
    everything = _fetch(accomplishments_collection)
    pinned = sorted((a for a in everything if "priority" in a), key=lambda a: a["priority"])
    awards = pinned + [a for a in everything if "priority" not in a]
    for a in awards:
        a["is_logo"] = a.get("image") in LOGO_IMAGES
        m = re.search(r"\b(20\d\d)\b", a.get("title", ""))
        a["year"] = m.group(1) if m else ""
        link = a.get("link") or ""
        if link.startswith("/"):
            a["link"] = "#" + SECTION_ANCHORS.get(link.strip("/"), link.strip("/"))
    return awards


@cached("experiences")
def get_experiences():
    exps = sorted(_fetch(experiences_collection), key=lambda e: e.get("priority", 99))
    for e in exps:
        e["title"] = (e.get("title") or "").strip()
        e["is_logo"] = e.get("image") in LOGO_IMAGES
    return exps


@cached("skills")
def get_skills():
    everything = _fetch(skills_collection)

    def group(section):
        seen, out = set(), []
        for s in everything:
            if s.get("section") != section:
                continue
            key = (s.get("title") or "").strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            s["title"] = SKILL_DISPLAY_NAMES.get(key, s["title"].strip())
            out.append(s)
        return out

    return {"programming": group("programming"), "tools": group("tool"), "soft": group("soft")}


@cached("extra_curriculars")
def get_extra_curriculars():
    ecs = _fetch(extra_curriculars_collection)
    for e in ecs:
        e["is_logo"] = e.get("image") in LOGO_IMAGES
    return ecs


@app.context_processor
def inject_globals():
    return {"asset_v": ASSET_VERSION, "linkedin_url": LINKEDIN_URL, "resume_link_days": RESUME_LINK_DAYS}


@app.route("/")
def home():
    projects = get_projects()
    return render_template(
        "index.html",
        featured=projects[:4],
        more_projects=projects[4:],
        awards=get_awards(),
        experiences=get_experiences(),
        skills=get_skills(),
        ecs=get_extra_curriculars(),
    )


# ---------------------------------------------------------------------------
# Resume requests
#
# The resume carries a phone number and email, so it is not a static file. A visitor leaves
# a name, email and optional note; that is saved to `resume_requests` and Irvin gets an email
# with a review link. Approving emails the visitor a download link that works for
# RESUME_LINK_DAYS. Links are signed with SECRET_KEY, and every download re-checks the
# request's status, so revoking on the review page cuts a link off early. The PDF itself lives
# in `resume_files` (scripts/upload_resume.py puts it there), never in static/ or the repo.
# ---------------------------------------------------------------------------

# Links in emails are built from SITE_URL, never from the request's Host header: a spoofed
# Host would otherwise put an attacker's domain in the review link Irvin clicks.
SITE_URL = os.getenv("SITE_URL", "https://www.irvinsivya.com").rstrip("/")
RESUME_NOTIFY_EMAIL = os.getenv("RESUME_NOTIFY_EMAIL", "irvinsivya@gmail.com")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM") or SMTP_USER

RESUME_LINK_DAYS = 7
REVIEW_LINK_DAYS = 30
REQUESTS_PER_IP_PER_HOUR = 5
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
RESUME_FALLBACK = f"Something went wrong on my end. Email me at {RESUME_NOTIFY_EMAIL} and I'll send it over."


def _utcnow():
    # Naive UTC, which is what pymongo hands back, so stored and fresh times compare cleanly.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _signer():
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("SECRET_KEY is not set; resume links can't be signed")
    return URLSafeTimedSerializer(app.config["SECRET_KEY"])


def _link(endpoint, request_id, salt):
    return SITE_URL + url_for(endpoint, token=_signer().dumps(str(request_id), salt=salt))


def _load_request(token, salt, max_days):
    """The request a signed link points at, or None if it no longer exists. Raises
    SignatureExpired for an old link and BadSignature for a forged or mangled one."""
    request_id = _signer().loads(token, salt=salt, max_age=max_days * 86400)
    try:
        return resume_requests_collection.find_one({"_id": ObjectId(request_id)})
    except InvalidId:
        return None


def _smtp_send(msg):
    if not (SMTP_USER and SMTP_PASSWORD):
        raise RuntimeError("SMTP_USER / SMTP_PASSWORD are not set")
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)


def _send_mail(to, subject, body, reply_to=None):
    msg = EmailMessage()
    msg["From"] = formataddr(("Irvin Sivya", MAIL_FROM or ""))
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)
    _smtp_send(msg)


def _one_line(value, limit):
    # Collapsing whitespace also strips newlines, which keeps names out of header injection.
    return " ".join((value or "").split())[:limit]


@app.template_filter("utc")
def _format_utc(dt):
    # Built by hand: Windows' strftime has no %-d, and local runs should match Vercel.
    return f"{dt:%b} {dt.day}, {dt:%Y} · {dt:%H:%M} UTC" if dt else ""


def _client_ip():
    # Vercel overwrites X-Forwarded-For with the real client address, so it can't be spoofed there.
    return (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip() or request.remote_addr


@cached("resume_pdf")
def get_resume_pdf():
    try:
        return resume_files_collection.find_one({"_id": "current"})
    except Exception as exc:  # noqa: BLE001
        app.logger.error("resume PDF query failed: %s", exc)
        return None


def _resume_reply(form, sent=False, errors=None, error=None, status=200):
    """The form posts with fetch from the dialog on the home page (JSON back), or as a plain
    form from /resume when JavaScript is off (the page re-renders)."""
    if request.accept_mimetypes.best == "application/json":
        return jsonify(ok=sent, errors=errors or {}, error=error), status
    return render_template("resume.html", form=form, sent=sent, errors=errors or {}, error=error), status


def _notify_owner(doc):
    lines = [f"{doc['name']} <{doc['email']}> asked for your resume.", ""]
    if doc["note"]:
        lines += ["Their note:", doc["note"], ""]
    lines += [
        "Approve or deny:",
        _link("resume_review", doc["_id"], "resume-review"),
        "",
        f"The link works for {REVIEW_LINK_DAYS} days. Replying to this email goes to them.",
    ]
    _send_mail(RESUME_NOTIFY_EMAIL, f"Resume request from {doc['name']}", "\n".join(lines), reply_to=doc["email"])


def _send_resume_link(req):
    link = _link("resume_download", req["_id"], "resume-download")
    first = req["name"].split()[0]
    body = (
        f"Hi {first},\n\n"
        f"Thanks for your interest. Here's my resume:\n{link}\n\n"
        f"The link works for {RESUME_LINK_DAYS} days. If it runs out, request it again on "
        f"irvinsivya.com, or just reply to this email.\n\n"
        "Irvin"
    )
    _send_mail(req["email"], "Irvin Sivya's resume", body, reply_to=RESUME_NOTIFY_EMAIL)
    return link


@app.route("/resume", methods=["GET", "POST"])
def resume():
    if request.method == "GET":
        return render_template("resume.html", form={}, sent=False, errors={}, error=None)

    form = {
        "name": _one_line(request.form.get("name"), 100),
        "email": _one_line(request.form.get("email"), 254),
        "note": (request.form.get("note") or "").strip()[:1000],
    }

    # People never see this field; bots that fill in every input do. Pretend it worked.
    if request.form.get("company"):
        return _resume_reply(form, sent=True)

    errors = {}
    if not form["name"]:
        errors["name"] = "Add your name."
    if not EMAIL_RE.match(form["email"]):
        errors["email"] = "That email doesn't look right."
    if errors:
        return _resume_reply(form, errors=errors, status=400)

    now = _utcnow()
    ip = _client_ip()
    try:
        recent = resume_requests_collection.count_documents({"ip": ip, "created_at": {"$gte": now - timedelta(hours=1)}})
        if recent >= REQUESTS_PER_IP_PER_HOUR:
            return _resume_reply(form, error="Too many requests from your network. Try again in an hour.", status=429)

        # A second click from the same address shouldn't email Irvin twice.
        if resume_requests_collection.find_one({
            "email_key": form["email"].lower(),
            "status": "pending",
            "notified": True,
            "created_at": {"$gte": now - timedelta(days=1)},
        }):
            return _resume_reply(form, sent=True)

        doc = {
            **form,
            "email_key": form["email"].lower(),
            "status": "pending",
            "notified": False,
            "created_at": now,
            "ip": ip,
            "user_agent": request.headers.get("User-Agent", "")[:300],
            "downloads": 0,
        }
        doc["_id"] = resume_requests_collection.insert_one(doc).inserted_id
    except Exception as exc:  # noqa: BLE001
        app.logger.error("saving resume request failed: %s", exc)
        return _resume_reply(form, error=RESUME_FALLBACK, status=503)

    try:
        _notify_owner(doc)
        resume_requests_collection.update_one({"_id": doc["_id"]}, {"$set": {"notified": True}})
    except Exception as exc:  # noqa: BLE001
        app.logger.error("resume request %s: emailing Irvin failed: %s", doc["_id"], exc)
        return _resume_reply(form, error=RESUME_FALLBACK, status=502)

    return _resume_reply(form, sent=True)


@app.route("/resume/review/<token>", methods=["GET", "POST"])
def resume_review(token):
    try:
        req = _load_request(token, "resume-review", REVIEW_LINK_DAYS)
    except SignatureExpired:
        return render_template("resume_link.html", state="review-expired"), 410
    except BadSignature:
        return render_template("resume_link.html", state="invalid"), 404
    if not req:
        return render_template("resume_link.html", state="invalid"), 404

    notice = None
    action = request.form.get("action") if request.method == "POST" else None
    if action == "approve" and req["status"] != "approved":
        update = {"status": "approved", "decided_at": _utcnow()}
        resume_requests_collection.update_one({"_id": req["_id"]}, {"$set": update})
        req.update(update)
        try:
            _send_resume_link(req)
            notice = f"Approved. {req['email']} has their link."
        except Exception as exc:  # noqa: BLE001
            app.logger.error("resume request %s: emailing the link failed: %s", req["_id"], exc)
            link = _link("resume_download", req["_id"], "resume-download")
            notice = f"Approved, but the email didn't send ({exc}). Send them this link yourself: {link}"
    elif action == "deny" and req["status"] != "denied":
        update = {"status": "denied", "decided_at": _utcnow()}
        resume_requests_collection.update_one({"_id": req["_id"]}, {"$set": update})
        was_approved = req["status"] == "approved"
        req.update(update)
        notice = "Access revoked. Their link no longer works." if was_approved else "Denied. They won't be emailed."

    return render_template("resume_review.html", req=req, notice=notice, link_days=RESUME_LINK_DAYS)


@app.route("/resume/download/<token>")
def resume_download(token):
    try:
        req = _load_request(token, "resume-download", RESUME_LINK_DAYS)
    except SignatureExpired:
        return render_template("resume_link.html", state="expired"), 410
    except BadSignature:
        return render_template("resume_link.html", state="invalid"), 404
    if not req or req.get("status") != "approved":
        return render_template("resume_link.html", state="invalid"), 404

    pdf = get_resume_pdf()
    if not pdf:
        return render_template("resume_link.html", state="unavailable"), 503

    resume_requests_collection.update_one(
        {"_id": req["_id"]}, {"$inc": {"downloads": 1}, "$set": {"last_download_at": _utcnow()}}
    )
    resp = Response(pdf["data"], mimetype="application/pdf")
    resp.headers["Content-Disposition"] = f'inline; filename="{pdf.get("filename", "Irvin_Sivya_Resume.pdf")}"'
    resp.headers["Cache-Control"] = "private, no-store"
    resp.headers["X-Robots-Tag"] = "noindex"
    return resp


@app.route("/favicon.ico")
def favicon():
    return redirect(url_for("static", filename="favicon.png"))


def _section_redirect(anchor):
    def view():
        return redirect(url_for("home") + "#" + anchor)
    return view


for _path, _anchor in SECTION_ANCHORS.items():
    app.add_url_rule("/" + _path, endpoint=_path, view_func=_section_redirect(_anchor))


if __name__ == "__main__":
    app.run(debug=True)
