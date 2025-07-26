import os
from pymongo import MongoClient

MONGO_URI = os.environ.get("MONGO_URI")
client = MongoClient(MONGO_URI)

db = client.my_portfolio
skills_collection = db.skills
accomplishments_collection = db.accomplishments
projects_collection = db.projects
extra_curriculars_collection = db.extra_curriculars
experiences_collection = db.experiences
