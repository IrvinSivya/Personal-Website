import os
from dotenv import load_dotenv
from flask import Flask, render_template, request, url_for, redirect, jsonify
from db_client import (
    db,
    skills_collection,
    accomplishments_collection,
    projects_collection,
    extra_curriculars_collection,
    experiences_collection
)

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY")

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
    experiences = list(experiences_collection.find())
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
    update_collection(collection_name='accomplishments', filter_query={'title': 'Dean\'s List Winner at Durham'}, 
                      update_fields= {'description': 'After a long season of hard work and leadership, I was able to achieve the Dean\'s List at Durham College in 2024 with FRC team 1285!', 
                      'image': 'durham_deans.jpg'})
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

    #insert_document(collection_name='experiences', document_data={'title': "Code Ninjas Instructor", 'description': 'To be added', 'image': 'codeninjas.png'})

    app.run(debug=True)