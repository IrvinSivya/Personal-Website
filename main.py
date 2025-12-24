import os
from dotenv import load_dotenv
from pymongo import MongoClient
from flask import Flask, render_template, request, url_for, redirect, jsonify

load_dotenv()

app = Flask(__name__)
SECRET_KEY = os.getenv("SECRET_KEY")
app.config['SECRET_KEY'] = SECRET_KEY

MONGO_URI = os.environ.get("MONGO_URI")
client = MongoClient(MONGO_URI)

db = client.my_portfolio
skills_collection = db.skills
accomplishments_collection = db.accomplishments
projects_collection = db.projects
extra_curriculars_collection = db.extra_curriculars
experiences_collection = db.experiences

@app.route("/")
def home():
    return render_template("home.html")

@app.route("/skills")
def skills():
    programming_skills = list(skills_collection.find({"section": "programming"}))
    tools = list(skills_collection.find({"section": "tool"}))
    soft_skills = list(skills_collection.find({"section": "soft"}))
    return render_template("skills.html", programming_skills=programming_skills, tools=tools, soft_skills=soft_skills)

@app.route("/accomplishments")
def accomplishments():
    accomplishments = list(accomplishments_collection.find())
    return render_template("accomplishments.html", accomplishments=accomplishments)

@app.route("/projects")
def projects():
    projects = list(projects_collection.find())
    return render_template("projects.html",projects=projects)

@app.route("/extra_curriculars")
def extra_curriculars():
    ecs = list(extra_curriculars_collection.find())
    return render_template("extra_curriculars.html", ecs=ecs)

@app.route("/experiences")
def experiences():
    experiences = list(experiences_collection.find().sort({'priority': 1}))
    return render_template("experience.html",experiences=experiences)

def update_collection(collection_name, filter_query, update_fields):
    collections = {'skills': skills_collection,
                   'accomplishments': accomplishments_collection,
                   'projects': projects_collection, 
                   'extra_curriculars': extra_curriculars_collection,
                   'experiences': experiences_collection}
    
    if collection_name not in collections:
        raise ValueError("Collection don't exist")

    collection = db[collection_name]
    collection.update_one(filter_query, {"$set": update_fields}, upsert=False)

def insert_document(collection_name, document_data):
    collections = {'skills': skills_collection,
                   'accomplishments': accomplishments_collection,
                   'projects': projects_collection, 
                   'extra_curriculars': extra_curriculars_collection,
                   'experiences': experiences_collection}
                   
    if collection_name not in collections:
        raise ValueError("Collection don't exist")

    collection = db[collection_name]

    if collection.find_one({"title": document_data["title"]}) is not None:
        raise ValueError("Document with this title already exists")
    
    collection.insert_one(document_data)

if __name__ == "__main__":
    
    #Examples:
    
    '''
    update_collection(collection_name='extra_curriculars', filter_query={'title': 'Powerlifting'}, 
                      update_fields= {'description': 'My journey to this sport goes as follows: went to gym = wanted to get stronger = joined powerlifting. I now not only hold my school’s all time bench and deadlift records for the 66 kg weight class, but I also hold the title of not skipping leg day 💪.', 
                      })
    '''
    '''
    insert_document(
        collection_name='accomplishments',
        document_data={
            'title': 'Dean\'s List Winner at Durham',
            'description': 'Dedicated effort and leadership throughout the season won me the Dean\'s List Award at Durham College in 2024 with FRC team 1285.',
            'image': 'durham_deans.jpg'
        }
    )
    '''
    '''
    insert_document(
        collection_name='experiences',
        document_data={
            'title': 'SalesPatriot Internship ',
            'description': 'Wanting to learn more about machine learning and AI agents, I interned at SalesPatriot through HUVTSP 2025. To address AI hallucinations, I pitched a logging and reliability analysis dashboard for AI responses.',
            'image': 'SalesPatriot.png',
            'time': 'July 2025 - August 2025'
        }
    )
    '''
    

    #insert_document(collection_name='projects', document_data={'title': 'SalesPatriot Logging Dashboard', 'description': 'Amazing stuff', 'image': 'wow.png'})

    app.run(debug=True)