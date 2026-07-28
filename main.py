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
    # Identify the 2025 FRC robot project by its image so we don't depend on its
    # exact title. If not found, the order falls back to LibeCode, CrimeWatcher.
    robot = projects_collection.find_one({'image': '2025_robot.webp'})
    featured_titles = ['LibeCode']
    if robot:
        featured_titles.append(robot['title'])
    featured_titles.append('CrimeWatcher')
    featured_titles.append('OJuggle')
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
    return collection.update_one(filter_query, {"$set": update_fields}, upsert=False)

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

    # Idempotent wrapper: skip titles that already exist so a partial run can be
    # re-run safely. Prints what it did.
    def safe_insert(collection_name, document_data):
        try:
            insert_document(collection_name, document_data)
            print(f"inserted:  {document_data['title']}")
        except ValueError:
            print(f"skipped (already exists):  {document_data['title']}")

    # Insert if missing, otherwise update the given fields. Use this when a doc
    # may already exist in the DB but its fields need to change.
    def upsert(collection_name, title, fields):
        data = dict(fields, title=title)
        res = db[collection_name].update_one({'title': title}, {'$set': data}, upsert=True)
        if res.upserted_id:
            print(f"inserted:  {title}")
        elif res.matched_count:
            print(f"updated:   {title}")
        else:
            print(f"no change: {title}")

    # Shared LinkedIn post (the "2nd 2nd 1st in 5 days" hackathon recap).
    LINKEDIN_POST = 'https://www.linkedin.com/posts/irvin-sivya_%F0%9D%9F%AE%F0%9D%97%BB%F0%9D%97%B1-%F0%9D%9F%AE%F0%9D%97%BB%F0%9D%97%B1-%F0%9D%9F%AD%F0%9D%98%80%F0%9D%98%81-%F0%9D%97%B6%F0%9D%97%BB-%F0%9D%9F%B1-%F0%9D%97%B1%F0%9D%97%AE%F0%9D%98%86%F0%9D%98%80-ugcPost-7485405881447116800-3B3d/?utm_source=share&utm_medium=member_desktop&rcm=ACoAAFvF7x0BKNcghKQi5o4TK9uY8deEDR2Cj40'

    # --- New Projects ---

    upsert('projects', 'CrimeWatcher', {
        'description': "CrimeWatcher forecasts neighbourhood crime risk across Toronto. I trained a gradient boosted model on 474,819 Toronto Police incident records, scored all 158 neighbourhoods, and rendered the result as a live choropleth. The features are lag, seasonal, and spatial terms built in Pandas, and the last six months are held out so the model is never scored on data it has already seen. It's paired with a mobile app where a spoken safe word sends your GPS location straight to the dashboard as a live pin. Next.js and Leaflet on the front, Supabase underneath, Expo for the app.",
        'tech': 'Python, pandas, NumPy, Scikit-learn, Next.js, Leaflet, Supabase, Expo',
        'link': 'https://devpost.com/software/crimewatcher-vq93bw',
        'linkedin': LINKEDIN_POST,
        'image': 'CrimeWatcher.png'
    })
    upsert('projects', 'OJuggle', {
        'description': "OJuggle is a 1v1 soccer keep-ups platform. Two people go head to head and the app scores the trick difficulty, so flashier moves earn more points. We built it in a 90-minute window at Code the Cup, hosted by Google Developer Groups Toronto at Northeastern University. We didn't have a soccer ball on site, so the demo ran on a hoodie stuffed in a blue bag. We won 1st place.",
        'linkedin': LINKEDIN_POST,
        'image': 'OJuggle.png'
    })
    upsert('projects', 'LaunchScore', {
        'description': "LaunchScore is a launch-readiness auditor for AI-generated storefronts. You paste in a store URL and get back an overall score, category scores, and a per-product breakdown of what's working and what isn't. It doesn't touch the store, it just tells the merchant what's costing them sales and what to fix first. Every finding is backed by evidence, either a check run in code or a comparison against real listings that sell well, so nothing in the report is guesswork. Findings are also tagged by type, which means results roll up across every store audited and Daybot can see which mistakes keep repeating. Built with a partner on Next.js and Supabase in about six hours, second place.",
        'linkedin': LINKEDIN_POST,
        'image': 'LaunchScore.png'
    })
    safe_insert(
        collection_name='projects',
        document_data={
            'title': 'ExpenseCity',
            'description': 'ExpenseCity is an expense tracker that renders your spending as a 3D city, where each building\'s height is the size of an expense. I built it at IBM\'s Bobathon, where it placed 2nd.',
            'image': 'ExpenseCity.jpg',
            'linkedin': LINKEDIN_POST
        }
    )
    # ExpenseCity was first inserted with a placeholder image and no LinkedIn link;
    # fix both on the existing doc.
    r = update_collection(
        collection_name='projects',
        filter_query={'title': 'ExpenseCity'},
        update_fields={'image': 'ExpenseCity.jpg', 'linkedin': LINKEDIN_POST}
    )
    print(f"update ExpenseCity image + LinkedIn: matched {r.matched_count} document(s)")

    # --- Update SalesPatriot Logging Dashboard (info + logo image) ---
    # TODO: if matched 0, confirm the exact stored title of this project.
    r = update_collection(
        collection_name='projects',
        filter_query={'title': 'SalesPatriot Logging Dashboard'},
        update_fields={
            'description': "Built during a six-week internship at SalesPatriot (YC W25), placed through Harvard's Undergraduate Ventures-TECH Summer Program. The dashboard tracks where the company's AI gets things wrong: it flags hallucinations in model output, sorts them by failure type, and charts the rates over time so the team can see reliability move instead of guessing at it. A partner and I defined what counted as a failure and the schema that stored it, which turned out to be most of the work, since scattered model output isn't much use until it's records you can count. Python and Flask on the backend, MongoDB for storage, Chart.js for the visuals.",
            'image': 'SalesPatriot.png'
        }
    )
    print(f"update SalesPatriot Logging Dashboard: matched {r.matched_count} document(s)")
    # Remove the GitHub link/button for now (may add back later).
    r = projects_collection.update_one(
        {'title': 'SalesPatriot Logging Dashboard'}, {'$unset': {'github': ''}})
    print(f"remove SalesPatriot GitHub link: modified {r.modified_count} document(s)")

    # --- Remove BotMarket project ---

    r = projects_collection.delete_one({'title': 'BotMarket'})
    print(f"delete BotMarket: removed {r.deleted_count} document(s)")

    # --- Update LibeCode (kept general on purpose) ---

    r = update_collection(
        collection_name='projects',
        filter_query={'title': 'LibeCode'},
        update_fields={
            'description': 'I am currently working on LibeCode full time with my co-founder. We are advised by professors at the University of Toronto and McMaster, with go-to-market mentorship from a co-founder of Vena Solutions. Coming soon.'
        }
    )
    print(f"update LibeCode: matched {r.matched_count} document(s)")

    # --- New Awards (accomplishments collection) ---

    safe_insert(
        collection_name='accomplishments',
        document_data={
            'title': 'AWS Certified Cloud Practitioner and AI Practitioner',
            'description': 'I earned the AWS Certified Cloud Practitioner and AWS Certified AI Practitioner certifications in July 2026.',
            'image': 'aws_certs.png'
        }
    )
    # Replace the old "Three Hackathons" award with a "4x Hackathon Winner" one.
    r = accomplishments_collection.delete_one({'title': 'Three Hackathons in Five Days'})
    print(f"delete Three Hackathons award: removed {r.deleted_count} document(s)")

    upsert('accomplishments', '4x Hackathon Winner', {
        'description': 'I placed at four hackathons: 1st at WolfHacks with Project R.O.S.E., 1st at GDG Code the Cup with OJuggle, 2nd at the Daybot hackathon with LaunchScore, and 2nd at the IBM Bobathon with ExpenseCity.',
        'image': 'GDGWinner.jpg',
        'link': '/projects'
    })
    # link_text is no longer used; the template renders an inline link instead.
    accomplishments_collection.update_one({'title': '4x Hackathon Winner'}, {'$unset': {'link_text': ''}})

    # --- Remove Highest Autonomous Score award ---

    r = accomplishments_collection.delete_one({'title': 'Highest Autonomous Score at the 2025 FRC World Championship'})
    print(f"delete Highest Autonomous Score award: removed {r.deleted_count} document(s)")

    # --- Ordering: Schulich nominee, then 4x Hackathon Winner, then AWS cert ---
    # Awards with a 'priority' render first (ascending), the rest follow. We give
    # the two new awards fractional priorities just above Schulich's, so they slot
    # in directly below it without moving any other award.
    schulich = accomplishments_collection.find_one({'title': {'$regex': 'Schulich', '$options': 'i'}})
    if schulich is None:
        print("ordering: no Schulich award found (check its exact title)")
    else:
        p = schulich.get('priority')
        if p is None:
            top = accomplishments_collection.find_one({'priority': {'$exists': True}}, sort=[('priority', -1)])
            p = (top['priority'] + 1) if top else 1
            accomplishments_collection.update_one({'_id': schulich['_id']}, {'$set': {'priority': p}})
            print(f"ordering: pinned '{schulich['title']}' at priority {p}")
        else:
            print(f"ordering: '{schulich['title']}' is at priority {p}")
        accomplishments_collection.update_one(
            {'title': '4x Hackathon Winner'}, {'$set': {'priority': p + 0.1}})
        accomplishments_collection.update_one(
            {'title': 'AWS Certified Cloud Practitioner and AI Practitioner'}, {'$set': {'priority': p + 0.2}})
        print("ordering: placed 4x Hackathon Winner, then AWS cert, directly below Schulich")
    pinned = list(accomplishments_collection.find({'priority': {'$exists': True}}).sort('priority', 1))
    rest = list(accomplishments_collection.find({'priority': {'$exists': False}}))
    print("ordering: accomplishments now render in this order:")
    for a in pinned + rest:
        print("   -", a['title'])

    # --- Extracurriculars: update FRC Robotics + add Data Science ---

    ec = extra_curriculars_collection.find_one({'title': {'$regex': 'robot|frc', '$options': 'i'}})
    if ec is None:
        print("EC robotics: no matching extracurricular found (check its title)")
    else:
        extra_curriculars_collection.update_one({'_id': ec['_id']}, {'$set': {
            'description': "After FLL in middle school, I signed up for FRC in Grade 9. I started on Team 1285 as a drive team member and lead programmer, then joined Team 1241 as lead programmer. 4 years and 2,000+ hours later, I've learned PID control, OOP, motion profiling, odometry, vision tracking, and path following. Competed internationally 3x."
        }})
        print(f"EC robotics: updated '{ec['title']}'")

    # Renamed from "Data Science"; remove the old doc if a prior run created it.
    extra_curriculars_collection.delete_one({'title': 'Data Science'})
    upsert('extra_curriculars', 'Data Science + ML', {
        'description': "I got into data science and ML from hackathons. I'm currently working through a machine learning book recommended to me by Professor Periklis Andritsos at the University of Toronto, and building models on real datasets to get better at the fundamentals. Will continue pursuing these fields at Waterloo.",
        'image': 'ml.jpg'
    })

    # --- Fixes to existing documents ---

    # Hackathons extracurricular: rewrite to past tense with four wins.
    # TODO: confirm the exact stored title of this entry ('Hackathons' is a guess).
    r = update_collection(
        collection_name='extra_curriculars',
        filter_query={'title': 'Hackathons'},
        update_fields={
            'description': 'Hackathons are where I do some of my best work. I have won four of them, taking each project from an idea to a working demo under a tight deadline.'
        }
    )
    print(f"update Hackathons EC: matched {r.matched_count} document(s)")

    # City of Brampton experiences: two duplicate cards. Delete the stale one
    # (the "will be starting in January 2026" card, tagged "Starting 2026") and
    # rewrite the card we keep (the one currently tagged "January 2026 - Present").
    r = experiences_collection.delete_one({'title': 'City of Brampton', 'time': 'Starting 2026'})
    print(f"delete stale Brampton card: removed {r.deleted_count} document(s)")

    r = update_collection(
        collection_name='experiences',
        filter_query={'title': 'City of Brampton', 'time': 'January 2026 - Present'},
        update_fields={
            'description': "I started with the City of Brampton as a volunteer instructor in robotics, app development, and coding. That turned into a part-time role in January 2026, and I now teach math, photography, and STEM through the city's recreation programs, filling in across the STEM catalogue on short notice.",
            'time': '2025 - Present'
        }
    )
    print(f"update Brampton card: matched {r.matched_count} document(s)")

    # SalesPatriot experience card: update the description (keep title, image, time).
    exp = experiences_collection.find_one({'title': {'$regex': 'SalesPatriot', '$options': 'i'}})
    if exp is None:
        print("SalesPatriot experience: no matching card found (check its title)")
    else:
        experiences_collection.update_one({'_id': exp['_id']}, {'$set': {
            'description': "Interned at SalesPatriot (YC W25) through HUVTSP 2025, drawn in by machine learning and AI agents. I built a logging and reliability dashboard that flags hallucinations in AI responses, sorts them by failure type, and tracks rates over time, then pitched it to the founder."
        }})
        print(f"SalesPatriot experience: updated '{exp['title']}'")

    app.run(debug=True)