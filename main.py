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
    pinned = list(accomplishments_collection.find({'priority': {'$exists': True}}).sort('priority', 1))
    rest = list(accomplishments_collection.find({'priority': {'$exists': False}}))
    accomplishments = pinned + rest
    return render_template("accomplishments.html", accomplishments=accomplishments)

@app.route("/projects")
def projects():
    featured = list(projects_collection.find({'title': 'LibeCode'}))
    rest = list(projects_collection.find({'title': {'$ne': 'LibeCode'}}))
    projects = featured + rest
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

    # --- Accomplishments ---

    '''
    insert_document(
        collection_name='accomplishments',
        document_data={
            'title': 'Wolfhacks 2025 - 1st Place',
            'description': 'Won 1st place out of 76 teams at Wolfhacks 2025, PDSB\'s largest hackathon. Our team tackled waste management with three parts: a waste-classifying AI built with Python and Transformers, a Java awareness app, and a Micro:bit bacteria prototype. I led the AI component – learned new libraries on the fly and pulled it all together in 48 hours.',
            'image': 'wolfhacks_win.webp'
        }
    )
    '''
    '''
    insert_document(
        collection_name='accomplishments',
        document_data={
            'title': 'Judges Award - 2025 FRC World Championship',
            'description': 'As lead programmer on FRC Team 1241, we earned the Judges Award at the 2025 FRC World Championship in the Hopper Division. Our outreach efforts – from robot demos to Girls+ in STEM events – along with our competitive performance on the field made this one happen.',
            'image': 'worlds_judges.jpg'
        }
    )
    '''
    '''
    insert_document(
        collection_name='accomplishments',
        document_data={
            'title': 'FRC Rookie All-Star Award 2023',
            'description': 'Won the Rookie All-Star Award in my first FRC season with Team 1285. As a first-year member, I picked up command-based programming quickly, contributed to the autonomous routine, and helped wherever I could to make the season a success.',
            'image': 'rookie_all_star.jpg'
        }
    )
    '''
    '''
    insert_document(
        collection_name='accomplishments',
        document_data={
            'title': 'FRC Innovation Award 2024',
            'description': 'Won the Innovation Award with FRC Team 1285, recognizing the creative technical solutions we brought to the 2024 season. This was also the year our team won the Durham College District Event and I earned FRC\'s Dean\'s List.',
            'image': 'innovation_award.jpg'
        }
    )
    '''
    '''
    insert_document(
        collection_name='accomplishments',
        document_data={
            'title': 'FRC Technical Leadership Award 2025',
            'description': 'Earned the Technical Leadership Award with FRC Team 1241 during the 2025 season. As lead programmer, I hosted workshops, mentored the subteam, and implemented key systems including a Ramsete path follower and vision-filtered localization.',
            'image': 'tech_leadership.jpg'
        }
    )
    '''

    # --- Experiences ---

    '''
    insert_document(
        collection_name='experiences',
        document_data={
            'title': 'Harvard HUVTSP',
            'description': 'Participated in Harvard\'s Undergraduate Ventures-TECH Summer Program (HUVTSP) in the summer of 2025. Got exposure to the startup world through fireside chats with founders and executives – including Lila Snyder and Mark Cuban – while developing entrepreneurial skills alongside my SalesPatriot internship.',
            'image': 'huvtsp.jpg',
            'time': 'Summer 2025'
        }
    )
    '''

    # --- Extra Curriculars ---

    '''
    insert_document(
        collection_name='extra_curriculars',
        document_data={
            'title': 'CSMC Prep Club',
            'description': 'Co-founded my school\'s Waterloo CSMC Prep Club during Grade 12. As co-president, I ran weekly study sessions and built custom slideshows to help classmates tackle the Senior Math Contest. The prep paid off – I won the School Champion Award at the 2025 CSMC and earned a Certificate of Distinction.',
            'image': 'csmc_club.jpg'
        }
    )
    '''

    app.run(debug=True)