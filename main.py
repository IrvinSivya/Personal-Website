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
    featured_titles = ['CrimeWatcher', 'LibeCode']
    featured = []
    for title in featured_titles:
        featured += list(projects_collection.find({'title': title}))
    rest = list(projects_collection.find({'title': {'$nin': featured_titles}}))
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

    # ==========================================================================
    # NEW CONTENT (2026) - uncomment a block, run `python main.py` once to write
    # it to MongoDB, then re-comment. Every 'image' below is a placeholder:
    # drop the real file in the folder named in the comment and match the name.
    # ==========================================================================

    # --- New Projects ---

    '''
    insert_document(
        collection_name='projects',
        document_data={
            'title': 'CrimeWatcher',
            'description': 'CrimeWatcher is an ML pipeline that forecasts crime risk across all 158 Toronto neighbourhoods from 474K Toronto Police records. It uses a HistGradientBoostingRegressor with time-based splits and spatial-lag features, served through a Next.js and Leaflet dashboard. A companion voice-activated distress app pushes live emergencies onto the map through Supabase Realtime. I am still tuning the model before it goes live.',
            'tech': 'Python, pandas, NumPy, Scikit-learn, Next.js, Leaflet, Supabase, Expo',
            'link': 'https://devpost.com/software/crimewatcher-vq93bw',
            'image': 'crimewatcher.png'  # TODO: add file to static/images/projects/
        }
    )
    '''
    '''
    insert_document(
        collection_name='projects',
        document_data={
            'title': 'OJuggle',
            'description': 'OJuggle is a 1v1 soccer keep-ups competition that scores trick difficulty. I built it in a 90-minute window at Google Developer Groups Toronto Code the Cup. There was no ball on site, so we demoed with a hoodie stuffed in a bag. We took 1st place.',
            'image': 'ojuggle.png'  # TODO: add file to static/images/projects/
        }
    )
    '''
    '''
    insert_document(
        collection_name='projects',
        document_data={
            'title': 'LaunchScore',
            'description': 'LaunchScore is an e-commerce store ranker I built at the Daybot hackathon, where it placed 2nd.',
            'image': 'launchscore.png'  # TODO: add file to static/images/projects/
        }
    )
    '''
    '''
    insert_document(
        collection_name='projects',
        document_data={
            'title': 'ExpenseCity',
            'description': 'ExpenseCity is an expense tracker that renders your spending as a 3D city, where each building\'s height is the size of an expense. I built it at IBM\'s Bobathon, where it placed 2nd.',
            'image': 'expensecity.png'  # TODO: add file to static/images/projects/
        }
    )
    '''
    '''
    insert_document(
        collection_name='projects',
        document_data={
            'title': 'BotMarket',
            'description': 'BotMarket is a consignment marketplace for used FRC, FTC, FLL, VEX, and WRO robotics parts. Teams consign their parts, and BotMarket lists and sells them.',
            'image': 'botmarket.png'  # TODO: add file to static/images/projects/
        }
    )
    '''

    # --- Update LibeCode (kept general on purpose) ---

    '''
    update_collection(
        collection_name='projects',
        filter_query={'title': 'LibeCode'},
        update_fields={
            'description': 'I work on LibeCode full time with my co-founder. We are advised by professors at the University of Toronto and McMaster, with go-to-market mentorship from a co-founder of Vena Solutions.'
        }
    )
    '''

    # --- New Awards (accomplishments collection) ---

    '''
    insert_document(
        collection_name='accomplishments',
        document_data={
            'title': 'AWS Certified Cloud Practitioner and AI Practitioner',
            'description': 'I earned the AWS Certified Cloud Practitioner and AWS Certified AI Practitioner certifications in July 2026.',
            'image': 'aws_certs.png'  # TODO: add file to static/images/accomplishments/
        }
    )
    '''
    '''
    insert_document(
        collection_name='accomplishments',
        document_data={
            'title': 'Three Hackathons in Five Days',
            'description': 'I competed in three hackathons over five days in July 2026 and placed in all of them: 2nd at Daybot, 2nd at the IBM Bobathon, and 1st at GDG Code the Cup.',
            'image': 'three_hackathons.png'  # TODO: add file to static/images/accomplishments/
        }
    )
    '''
    '''
    insert_document(
        collection_name='accomplishments',
        document_data={
            'title': 'Highest Autonomous Score at the 2025 FRC World Championship',
            'description': 'I set the highest autonomous score at the 2025 FRC World Championship.',
            'image': 'worlds_auto.png'  # TODO: add file to static/images/accomplishments/
        }
    )
    '''

    # --- Fixes to existing documents ---

    # Hackathons extracurricular: rewrite to past tense with four wins.
    # TODO: confirm the exact stored title of this entry ('Hackathons' is a guess).
    '''
    update_collection(
        collection_name='extra_curriculars',
        filter_query={'title': 'Hackathons'},
        update_fields={
            'description': 'Hackathons are where I do some of my best work. I have won four of them, taking each project from an idea to a working demo under a tight deadline.'
        }
    )
    '''

    # City of Brampton experience: was "Starting 2026", now a current role.
    # TODO: confirm the exact stored title ('City of Brampton' is a guess) and the
    # real start month. If "Starting 2026" also appears in the description text,
    # add 'description' to update_fields and rewrite it here too.
    '''
    update_collection(
        collection_name='experiences',
        filter_query={'title': 'City of Brampton'},
        update_fields={
            'time': 'January 2026 - Present'  # TODO: set the real start month
        }
    )
    '''

    app.run(debug=True)