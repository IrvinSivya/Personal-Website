import os
import re

from dotenv import load_dotenv
from flask import Flask, redirect, render_template, url_for
from pymongo import MongoClient

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

MONGO_URI = os.environ.get("MONGO_URI")
# Bounded timeouts: a stalled connection renders empty sections instead of hanging the function.
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000, connectTimeoutMS=8000, socketTimeoutMS=8000)

db = client.my_portfolio
skills_collection = db.skills
accomplishments_collection = db.accomplishments
projects_collection = db.projects
extra_curriculars_collection = db.extra_curriculars
experiences_collection = db.experiences

# Bump when CSS/JS change so Vercel's edge cache and browsers pick up the new files.
ASSET_VERSION = "2026.09.22c"

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


def _safe_list(cursor_factory):
    """Run a query; if the database is unreachable render the page without that section
    instead of a 500."""
    try:
        return list(cursor_factory())
    except Exception as exc:  # noqa: BLE001
        app.logger.error("database query failed: %s", exc)
        return []


def _link_label(url):
    u = (url or "").lower()
    if "youtube" in u or "youtu.be" in u:
        return "Watch"
    if "devpost" in u:
        return "Devpost"
    return "Live"


def get_projects():
    robot = projects_collection.find_one({"image": "2025_robot.webp"})
    featured_titles = ["LibeCode"]
    if robot:
        featured_titles.append(robot["title"])
    featured_titles += ["CrimeWatcher", "OJuggle"]

    featured = []
    for title in featured_titles:
        featured += _safe_list(lambda t=title: projects_collection.find({"title": t}))
    rest = _safe_list(lambda: projects_collection.find({"title": {"$nin": featured_titles}}))

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
        if p.get("github", "").rstrip("/").endswith("IrvinSivya/Personal-Website"):
            p["github"] = None
    return projects[:4], projects[4:]


def get_awards():
    pinned = _safe_list(lambda: accomplishments_collection.find({"priority": {"$exists": True}}).sort("priority", 1))
    rest = _safe_list(lambda: accomplishments_collection.find({"priority": {"$exists": False}}))
    awards = pinned + rest
    for a in awards:
        a["is_logo"] = a.get("image") in LOGO_IMAGES
        m = re.search(r"\b(20\d\d)\b", a.get("title", ""))
        a["year"] = m.group(1) if m else ""
        link = a.get("link") or ""
        if link.startswith("/"):
            a["link"] = "#" + SECTION_ANCHORS.get(link.strip("/"), link.strip("/"))
    return awards


def get_experiences():
    exps = _safe_list(lambda: experiences_collection.find().sort("priority", 1))
    for e in exps:
        e["title"] = (e.get("title") or "").strip()
        e["is_logo"] = e.get("image") in LOGO_IMAGES
    return exps


def get_skills():
    def group(section):
        seen, out = set(), []
        for s in _safe_list(lambda: skills_collection.find({"section": section})):
            key = (s.get("title") or "").strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            s["title"] = SKILL_DISPLAY_NAMES.get(key, s["title"].strip())
            out.append(s)
        return out

    return {"programming": group("programming"), "tools": group("tool"), "soft": group("soft")}


def get_extra_curriculars():
    ecs = _safe_list(lambda: extra_curriculars_collection.find())
    for e in ecs:
        e["is_logo"] = e.get("image") in LOGO_IMAGES
    return ecs


LINKEDIN_URL = "https://www.linkedin.com/in/irvin-sivya/"


@app.context_processor
def inject_globals():
    return {"asset_v": ASSET_VERSION, "linkedin_url": LINKEDIN_URL}


@app.route("/")
def home():
    featured, more_projects = get_projects()
    return render_template(
        "index.html",
        featured=featured,
        more_projects=more_projects,
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
