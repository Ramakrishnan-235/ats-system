import pytest
from ats_core.parsers.resume_parser import (
    parse_resume_to_candidate,
    extract_candidate_name,
    extract_phone_number,
    extract_location,
    extract_education,
    extract_skills_from_text,
    extract_experience_sections,
    calculate_candidate_experience_years,
)

DEVA_KUMAR_RESUME_TEXT = """
Deva Kumar B                                                      Cuddalore, Tamil Nadu
+91-86676-60065 | devakumar.b.cseacet@gmail.com | linkedin.com/in/deva-kumar-developer

PROFESSIONAL SUMMARY
Bachelor of Technology in Computer Science Engineering (CGPA 8.9) with four internships across frontend development (React, Tailwind CSS), data engineering (Python pipelines), and AI/ML proof-of-concepts. Demonstrated expertise in delivering production-grade features, leading and mentoring a 5-member team, and contributing to published research. Seeking 2026 new-graduate opportunities in Full-Stack Development or AI/ML Engineering.

EDUCATION
B.Tech Computer Science — Achariya College of Engineering Technology    2022–26 (exp)
CGPA 8.9/10 (5 sem) | HSC 93.5% | SSLC 95.3%

TECHNICAL SKILLS
Languages: Python, Java (beginner) , JavaScript, SQL | Frontend: React, Tailwind, HTML/CSS | Tools: Git, Firebase, Figma, Spline, MySQL, Jupyter, Colab | ML / misc: Pandas, Matplotlib, OpenCV, Roboflow

EXPERIENCE
Developer Intern                                                     May-Aug 2025
IINVSYS, Pondicherry
• Developed educational video content using Manim to create mathematical and visual animations and technical skills.
• Built multiple React projects, gaining hands-on experience in component-based design and modern frontend development.

Software Developer Intern                                            Dec 2024–Jan 2025
Ormatrix, Cuddalore
• Built React dashboards; closed 15+ UI bugs, improving Lighthouse score by 18 pts.

UI/UX Intern                                                         Jun–Jul 2024
Scode Software Solutions
• Delivered Figma hi-fi prototypes for 2 client apps; user-testing cut task time 20%.

Web Dev Intern                                                       Sep–Oct 2023
Ormatrix — Developed responsive landing pages (100/100 Lighthouse).

KEY PROJECTS
TED Tinder – React app with genre-based filtering, YouTube playback, and localStorage support for 300+ TED talks.
Finance Bot – Python dashboard; Pandas + Matplotlib real-time expense charts.
Real-time Chat App – WebSocket-based app with multi-room support, enabling seamless group communication.
AI Recipe Fridge – CV-based ingredient detection; 87% top-5 recipe accuracy.
Stock Analyser – Python script; SMA crossover back-test with 11% vs Nifty.

ACHIEVEMENTS
• Academic Topper 2023 | Best Project Award 2024 • Published paper Smart Wheelchair; led 5-member national-hackathon team.
• Led ultrasonic car & waste-management teams; organised ACETA symposium logistics. & organised the event along with Times of India.

CERTIFICATIONS
• C Programming — Bharathiar University (2018)
• Data Analysis with Python — FreeCodeCamp (2025)
• Operating System — Saylor Academy (2025)
• Prompt Engineering — AWS (2025)
"""


def test_deva_kumar_name_extraction():
    lines = [l.strip() for l in DEVA_KUMAR_RESUME_TEXT.split("\n") if l.strip()]
    name = extract_candidate_name(lines, email="devakumar.b.cseacet@gmail.com")
    assert name == "Deva Kumar B"


def test_deva_kumar_phone_extraction():
    phone = extract_phone_number(DEVA_KUMAR_RESUME_TEXT)
    assert phone == "+91-86676-60065"


def test_deva_kumar_location_extraction():
    loc = extract_location(DEVA_KUMAR_RESUME_TEXT, candidate_name="Deva Kumar B")
    assert loc == "Cuddalore, Tamil Nadu"
    assert "Deva Kumar B" not in loc


def test_deva_kumar_education_extraction():
    edu = extract_education(DEVA_KUMAR_RESUME_TEXT)
    assert "B.Tech" in edu or "Bachelor of Technology" in edu
    assert "Achariya College of Engineering Technology" in edu


def test_deva_kumar_skills_extraction():
    skills = extract_skills_from_text(DEVA_KUMAR_RESUME_TEXT)
    expected_skills = [
        "Python", "Java", "JavaScript", "SQL", "React", "Tailwind CSS", "HTML", "CSS",
        "Git", "Firebase", "Figma", "MySQL", "Pandas", "Matplotlib", "OpenCV", "Roboflow"
    ]
    for exp_skill in expected_skills:
        assert any(exp_skill.lower() == s.lower() or exp_skill.lower() in s.lower() for s in skills), f"Missing skill: {exp_skill}"


def test_deva_kumar_experience_extraction():
    experiences = extract_experience_sections(DEVA_KUMAR_RESUME_TEXT)
    assert len(experiences) >= 3
    roles = [e["role"] for e in experiences]
    assert any("Developer Intern" in r for r in roles)
    assert any("Software Developer Intern" in r for r in roles)
    assert any("UI/UX Intern" in r for r in roles)


def test_deva_kumar_years_of_experience():
    years = calculate_candidate_experience_years(DEVA_KUMAR_RESUME_TEXT)
    # A 2022-26 student with 4 internships should have ~1.0-2.0 years experience, NOT 8 years!
    assert 0.5 <= years <= 2.5
