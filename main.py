import mimetypes
import os
import re
import time
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, redirect, render_template, url_for
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

# Bump when CSS/JS change so Vercel's edge cache and browsers pick up the new files.
ASSET_VERSION = "2026.09.22d"

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
    return {"asset_v": ASSET_VERSION, "linkedin_url": LINKEDIN_URL}


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


@app.route("/resume")
def resume():
    return redirect(url_for("static", filename="Irvin_Sivya_Resume_Portfolio.pdf"))


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
