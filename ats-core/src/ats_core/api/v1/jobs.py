import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/jobs", tags=["Job Postings & Requisitions"])

# Realistic Candidate Avatars
SAMPLE_AVATARS = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80",
]

RAW_50_JOBS = [
    # 1. AI, Machine Learning & Intelligent Systems
    {
        "id": "job-001",
        "title": "Generative AI Developer",
        "department": "AI & Intelligent Systems",
        "location": "Remote / San Francisco",
        "job_description": "Builds applications using LLMs, prompt frameworks, and vector databases. Designs retrieval-augmented generation (RAG) pipelines, fine-tunes embeddings, and integrates cutting-edge foundation models into production systems.",
        "min_years_experience": 3.0,
        "required_skills": ["LLMs", "LangChain", "LlamaIndex", "Vector Databases", "Prompt Engineering", "Python", "RAG", "Embeddings"],
        "icon_type": "ai",
        "candidates_count": 28,
        "top_match_score": 96,
        "posted_date": "2026-02-10",
        "status": "OPEN",
    },
    {
        "id": "job-002",
        "title": "AI/ML Engineer",
        "department": "AI & Intelligent Systems",
        "location": "New York / Hybrid",
        "job_description": "Designs and develops core machine learning models and predictive algorithms. Trains, optimizes, and evaluates statistical and deep learning architectures for enterprise workloads.",
        "min_years_experience": 4.0,
        "required_skills": ["PyTorch", "TensorFlow", "Scikit-learn", "Python", "Machine Learning", "Predictive Modeling", "Deep Learning", "MLOps"],
        "icon_type": "ai",
        "candidates_count": 34,
        "top_match_score": 94,
        "posted_date": "2026-02-08",
        "status": "OPEN",
    },
    {
        "id": "job-003",
        "title": "MLOps Engineer",
        "department": "AI & Intelligent Systems",
        "location": "Remote",
        "job_description": "Deploys, monitors, and manages the lifecycle of machine learning pipelines. Establishes automated CI/CD for ML models, drift detection, feature stores, and containerized GPU serving.",
        "min_years_experience": 4.0,
        "required_skills": ["MLflow", "Kubeflow", "Docker", "Kubernetes", "CI/CD", "Model Monitoring", "Python", "Feature Stores"],
        "icon_type": "ai",
        "candidates_count": 19,
        "top_match_score": 91,
        "posted_date": "2026-02-05",
        "status": "OPEN",
    },
    {
        "id": "job-004",
        "title": "NLP Engineer",
        "department": "AI & Intelligent Systems",
        "location": "Boston / Remote",
        "job_description": "Specializes in machine comprehension of human language, chatbots, and translation systems. Implements transformer models, tokenization pipelines, sentiment analysis, and NER.",
        "min_years_experience": 3.0,
        "required_skills": ["NLP", "Hugging Face", "Transformers", "NLTK", "Spacy", "Python", "Text Processing", "Tokenization"],
        "icon_type": "ai",
        "candidates_count": 15,
        "top_match_score": 89,
        "posted_date": "2026-02-01",
        "status": "OPEN",
    },
    {
        "id": "job-005",
        "title": "Computer Vision Engineer",
        "department": "AI & Intelligent Systems",
        "location": "Seattle / Hybrid",
        "job_description": "Processes visual data for autonomous systems, robotics, and facial recognition. Develops real-time object detection, segmentation, and 3D point cloud processing pipelines.",
        "min_years_experience": 4.0,
        "required_skills": ["OpenCV", "YOLO", "PyTorch", "Image Processing", "Object Detection", "C++", "Python", "CUDA"],
        "icon_type": "ai",
        "candidates_count": 22,
        "top_match_score": 93,
        "posted_date": "2026-01-28",
        "status": "OPEN",
    },
    {
        "id": "job-006",
        "title": "AI Product Manager",
        "department": "AI & Intelligent Systems",
        "location": "San Francisco, CA",
        "job_description": "Bridges technical AI development teams with business strategy and user needs. Translates generative AI and machine learning capabilities into high-impact user experiences and measurable business metrics.",
        "min_years_experience": 4.0,
        "required_skills": ["AI Product Strategy", "Model Evaluation", "User Experience", "Roadmapping", "Agile", "Cross-functional Leadership"],
        "icon_type": "product",
        "candidates_count": 18,
        "top_match_score": 90,
        "posted_date": "2026-01-25",
        "status": "OPEN",
    },
    {
        "id": "job-007",
        "title": "Data Labeling & Annotation Specialist",
        "department": "AI & Intelligent Systems",
        "location": "Remote",
        "job_description": "Curates, cleans, and structures training datasets for high-performance AI models. Establishes gold-standard annotation guidelines, multi-modal labelling workflows, and active learning validation.",
        "min_years_experience": 1.0,
        "required_skills": ["Data Annotation", "Quality Assurance", "CVAT", "Label Studio", "Dataset Curation", "Data Cleaning"],
        "icon_type": "ai",
        "candidates_count": 12,
        "top_match_score": 86,
        "posted_date": "2026-01-20",
        "status": "OPEN",
    },
    {
        "id": "job-008",
        "title": "AI Ethics & Compliance Officer",
        "department": "AI & Intelligent Systems",
        "location": "Washington, DC / Remote",
        "job_description": "Ensures corporate AI applications adhere to legal, fairness, and safety standards. Conducts algorithmic bias auditing, regulatory impact assessments (EU AI Act, NIST AI RMF), and responsible AI guidelines.",
        "min_years_experience": 5.0,
        "required_skills": ["AI Governance", "Compliance", "Bias Auditing", "Risk Assessment", "GDPR", "Responsible AI"],
        "icon_type": "security",
        "candidates_count": 9,
        "top_match_score": 88,
        "posted_date": "2026-01-18",
        "status": "OPEN",
    },

    # 2. Cloud, DevOps & Infrastructure
    {
        "id": "job-009",
        "title": "Cloud Architect",
        "department": "Cloud & Infrastructure",
        "location": "Remote / Austin, TX",
        "job_description": "Designs overarching cloud strategy, migration plans, and multi-cloud architectures. Optimizes cloud cost, reliability, security, and hybrid-cloud topologies.",
        "min_years_experience": 7.0,
        "required_skills": ["AWS", "Azure", "GCP", "Cloud Architecture", "Terraform", "Well-Architected Framework", "Microservices"],
        "icon_type": "cloud",
        "candidates_count": 21,
        "top_match_score": 95,
        "posted_date": "2026-02-12",
        "status": "OPEN",
    },
    {
        "id": "job-010",
        "title": "Cloud Engineer",
        "department": "Cloud & Infrastructure",
        "location": "Denver, CO / Hybrid",
        "job_description": "Manages everyday infrastructure deployment and provisioning across AWS, Azure, or GCP. Builds automated serverless and containerized cloud resources.",
        "min_years_experience": 3.0,
        "required_skills": ["AWS", "Azure", "Linux", "Terraform", "CloudFormation", "Networking", "Docker"],
        "icon_type": "cloud",
        "candidates_count": 31,
        "top_match_score": 92,
        "posted_date": "2026-02-09",
        "status": "OPEN",
    },
    {
        "id": "job-011",
        "title": "DevOps Engineer",
        "department": "Cloud & Infrastructure",
        "location": "Remote",
        "job_description": "Builds automated CI/CD pipelines to bridge software development and IT operations. Implements infrastructure as code, release automation, and environment consistency.",
        "min_years_experience": 4.0,
        "required_skills": ["Jenkins", "GitHub Actions", "Docker", "Kubernetes", "CI/CD", "Bash", "Ansible", "Git"],
        "icon_type": "cloud",
        "candidates_count": 42,
        "top_match_score": 94,
        "posted_date": "2026-02-06",
        "status": "OPEN",
    },
    {
        "id": "job-012",
        "title": "Platform Engineer",
        "department": "Cloud & Infrastructure",
        "location": "San Francisco / Remote",
        "job_description": "Designs and maintains internal developer platforms (IDPs) to speed up coding workflows. Provides self-service tooling, Golden Paths, and standardized runtime environments for product engineering.",
        "min_years_experience": 5.0,
        "required_skills": ["Kubernetes", "Terraform", "Backstage", "GitOps", "Helm", "Developer Tooling", "Golang"],
        "icon_type": "cloud",
        "candidates_count": 16,
        "top_match_score": 90,
        "posted_date": "2026-02-02",
        "status": "OPEN",
    },
    {
        "id": "job-013",
        "title": "Site Reliability Engineer (SRE)",
        "department": "Cloud & Infrastructure",
        "location": "Remote / New York",
        "job_description": "Focuses on system availability, automation, and large-scale infrastructure resilience. Implements SLOs/SLAs, distributed tracing, automated incident remediation, and blameless post-mortems.",
        "min_years_experience": 5.0,
        "required_skills": ["SRE", "Prometheus", "Grafana", "Distributed Systems", "Incident Management", "Python", "Chaos Engineering"],
        "icon_type": "cloud",
        "candidates_count": 25,
        "top_match_score": 93,
        "posted_date": "2026-01-29",
        "status": "OPEN",
    },
    {
        "id": "job-014",
        "title": "Network Architect",
        "department": "Cloud & Infrastructure",
        "location": "Dallas, TX",
        "job_description": "Designs high-performance local, wide-area, and cloud-integrated enterprise communication networks. Configures SD-WAN, BGP peering, and multi-cloud interconnects.",
        "min_years_experience": 8.0,
        "required_skills": ["BGP", "OSPF", "SD-WAN", "Cloud Interconnects", "Network Design", "VPN", "Cisco / Juniper"],
        "icon_type": "cloud",
        "candidates_count": 11,
        "top_match_score": 87,
        "posted_date": "2026-01-22",
        "status": "OPEN",
    },
    {
        "id": "job-015",
        "title": "Network Engineer",
        "department": "Cloud & Infrastructure",
        "location": "Chicago, IL",
        "job_description": "Installs, configures, and maintains physical and virtual network hardware and routing systems. Troubleshoots routing protocols, firewall rules, and enterprise switches.",
        "min_years_experience": 3.0,
        "required_skills": ["Routing & Switching", "Firewalls", "VLANs", "TCP/IP", "DNS", "Wireshark", "Troubleshooting"],
        "icon_type": "cloud",
        "candidates_count": 19,
        "top_match_score": 85,
        "posted_date": "2026-01-19",
        "status": "OPEN",
    },
    {
        "id": "job-016",
        "title": "Systems Administrator",
        "department": "Cloud & Infrastructure",
        "location": "Atlanta, GA",
        "job_description": "Manages local servers, operating systems, hardware setups, and core digital office infrastructure. Maintains virtualized clusters, directory services, and system patch management.",
        "min_years_experience": 3.0,
        "required_skills": ["Linux", "Windows Server", "Active Directory", "VMware", "Bash/PowerShell", "Backup Recovery"],
        "icon_type": "cloud",
        "candidates_count": 27,
        "top_match_score": 88,
        "posted_date": "2026-01-14",
        "status": "OPEN",
    },

    # 3. Data Science, Analytics & Big Data
    {
        "id": "job-017",
        "title": "Data Scientist",
        "department": "Data Science & Analytics",
        "location": "Remote / New York",
        "job_description": "Combines statistics, programming, and modeling to extract business value and build predictive logic. Performs exploratory data analysis, hypothesis testing, and algorithmic feature engineering.",
        "min_years_experience": 3.0,
        "required_skills": ["Python", "R", "Statistical Modeling", "Machine Learning", "SQL", "Data Visualization", "Pandas"],
        "icon_type": "database",
        "candidates_count": 48,
        "top_match_score": 95,
        "posted_date": "2026-02-14",
        "status": "OPEN",
    },
    {
        "id": "job-018",
        "title": "Data Engineer",
        "department": "Data Science & Analytics",
        "location": "San Francisco / Hybrid",
        "job_description": "Creates data pipelines, architecture, and ETL systems to process massive datasets. Designs scalable batch and streaming data pipelines with workflow orchestrators.",
        "min_years_experience": 4.0,
        "required_skills": ["Apache Spark", "Airflow", "SQL", "Python", "ETL Pipelines", "Snowflake", "Data Lakehouse"],
        "icon_type": "database",
        "candidates_count": 39,
        "top_match_score": 93,
        "posted_date": "2026-02-11",
        "status": "OPEN",
    },
    {
        "id": "job-019",
        "title": "Analytics Engineer",
        "department": "Data Science & Analytics",
        "location": "Remote",
        "job_description": "Prepares, cleans, and structures data within warehouses for seamless business analysis. Writes version-controlled transformation models using dbt and modern data warehouse techniques.",
        "min_years_experience": 3.0,
        "required_skills": ["dbt", "SQL", "BigQuery", "Snowflake", "Data Modeling", "Git", "Metabase"],
        "icon_type": "database",
        "candidates_count": 26,
        "top_match_score": 91,
        "posted_date": "2026-02-07",
        "status": "OPEN",
    },
    {
        "id": "job-020",
        "title": "Business Intelligence (BI) Analyst",
        "department": "Data Science & Analytics",
        "location": "Chicago / Remote",
        "job_description": "Translates structured data into actionable executive dashboards and corporate reports. Partners with business leaders to track core KPIs, revenue drivers, and operational metrics.",
        "min_years_experience": 2.0,
        "required_skills": ["Power BI", "Tableau", "Advanced SQL", "DAX", "Dashboard Design", "KPI Reporting"],
        "icon_type": "database",
        "candidates_count": 35,
        "top_match_score": 89,
        "posted_date": "2026-02-03",
        "status": "OPEN",
    },
    {
        "id": "job-021",
        "title": "Big Data Architect",
        "department": "Data Science & Analytics",
        "location": "Seattle, WA",
        "job_description": "Designs large-scale data storage and compute environments using tools like Hadoop or Spark. Implements high-throughput distributed ingestion and lakehouse architecture.",
        "min_years_experience": 7.0,
        "required_skills": ["Hadoop", "Apache Spark", "Kafka", "Distributed Computing", "Delta Lake", "Architecture Design"],
        "icon_type": "database",
        "candidates_count": 14,
        "top_match_score": 94,
        "posted_date": "2026-01-27",
        "status": "OPEN",
    },
    {
        "id": "job-022",
        "title": "Database Administrator (DBA)",
        "department": "Data Science & Analytics",
        "location": "Remote / Phoenix",
        "job_description": "Manages, protects, and tunes the performance of relational and non-relational databases. Leads indexing optimization, high availability clustering, replication, and backup disaster recovery.",
        "min_years_experience": 5.0,
        "required_skills": ["PostgreSQL", "MySQL", "Query Optimization", "Database Replication", "Backup & Recovery", "Index Tuning"],
        "icon_type": "database",
        "candidates_count": 17,
        "top_match_score": 87,
        "posted_date": "2026-01-21",
        "status": "OPEN",
    },
    {
        "id": "job-023",
        "title": "Data Governance Specialist",
        "department": "Data Science & Analytics",
        "location": "New York, NY",
        "job_description": "Enforces corporate data policies, privacy standards, and data cataloging rules. Maintains data lineage, metadata definitions, and compliance with privacy regulations.",
        "min_years_experience": 4.0,
        "required_skills": ["Data Governance", "Collibra", "GDPR/CCPA Compliance", "Data Lineage", "Metadata Management", "Data Quality"],
        "icon_type": "database",
        "candidates_count": 13,
        "top_match_score": 86,
        "posted_date": "2026-01-16",
        "status": "OPEN",
    },

    # 4. Cybersecurity & Risk Management
    {
        "id": "job-024",
        "title": "Cybersecurity Analyst",
        "department": "Cybersecurity & Risk",
        "location": "Remote / Washington, DC",
        "job_description": "Monitors corporate networks for active threats and mitigates digital security breaches. Analyzes SIEM alerts, triages suspicious network anomalies, and enforces defense-in-depth controls.",
        "min_years_experience": 2.0,
        "required_skills": ["SIEM", "Incident Response", "Network Security", "Threat Hunting", "Log Analysis", "Firewalls"],
        "icon_type": "security",
        "candidates_count": 33,
        "top_match_score": 92,
        "posted_date": "2026-02-13",
        "status": "OPEN",
    },
    {
        "id": "job-025",
        "title": "Ethical Hacker / Penetration Tester",
        "department": "Cybersecurity & Risk",
        "location": "Remote",
        "job_description": "Proactively attacks internal networks to discover and patch structural vulnerabilities. Performs authorized red-team engagements, exploit chaining, and web/network penetration testing.",
        "min_years_experience": 4.0,
        "required_skills": ["Penetration Testing", "Metasploit", "Burp Suite", "Vulnerability Assessment", "Kali Linux", "Exploit Development"],
        "icon_type": "security",
        "candidates_count": 24,
        "top_match_score": 96,
        "posted_date": "2026-02-09",
        "status": "OPEN",
    },
    {
        "id": "job-026",
        "title": "Application Security Engineer",
        "department": "Cybersecurity & Risk",
        "location": "San Francisco / Remote",
        "job_description": "Ensures that custom software code and APIs are secure before deployment. Embeds SAST/DAST into CI/CD pipelines, performs threat modeling, and trains developers in secure coding practices.",
        "min_years_experience": 4.0,
        "required_skills": ["AppSec", "OWASP Top 10", "SAST/DAST", "Threat Modeling", "Secure Code Review", "API Security"],
        "icon_type": "security",
        "candidates_count": 20,
        "top_match_score": 91,
        "posted_date": "2026-02-04",
        "status": "OPEN",
    },
    {
        "id": "job-027",
        "title": "Cloud Security Specialist",
        "department": "Cybersecurity & Risk",
        "location": "Remote / Seattle",
        "job_description": "Focuses entirely on securing cloud architecture, access keys, and virtual networks. Implements Cloud Security Posture Management (CSPM), identity boundaries, and automated compliance policies.",
        "min_years_experience": 4.0,
        "required_skills": ["AWS Security", "IAM", "Cloud Custodian", "CSPM", "GuardDuty", "Zero Trust", "Compliance"],
        "icon_type": "security",
        "candidates_count": 27,
        "top_match_score": 94,
        "posted_date": "2026-01-30",
        "status": "OPEN",
    },
    {
        "id": "job-028",
        "title": "Identity and Access Management (IAM) Engineer",
        "department": "Cybersecurity & Risk",
        "location": "Remote",
        "job_description": "Controls user permissions, single sign-on (SSO), and digital identity authentication. Implements zero-trust access control, privilege management, and directory federations.",
        "min_years_experience": 4.0,
        "required_skills": ["Okta", "Ping Identity", "SAML", "OAuth 2.0 / OIDC", "Active Directory", "Zero Trust Architecture"],
        "icon_type": "security",
        "candidates_count": 18,
        "top_match_score": 89,
        "posted_date": "2026-01-24",
        "status": "OPEN",
    },
    {
        "id": "job-029",
        "title": "Security Operations Center (SOC) Manager",
        "department": "Cybersecurity & Risk",
        "location": "Austin, TX / Hybrid",
        "job_description": "Leads the real-time threat incident response team and defensive strategy. Oversees 24/7 detection, threat hunting operations, runbook automation, and executive breach escalation.",
        "min_years_experience": 6.0,
        "required_skills": ["SOC Leadership", "Incident Response", "SIEM", "Threat Intelligence", "Team Management", "Forensic Analysis"],
        "icon_type": "security",
        "candidates_count": 15,
        "top_match_score": 93,
        "posted_date": "2026-01-17",
        "status": "OPEN",
    },
    {
        "id": "job-030",
        "title": "Chief Information Security Officer (CISO)",
        "department": "Cybersecurity & Risk",
        "location": "New York / Executive",
        "job_description": "Directs the entire cybersecurity vision, risk budgeting, and security compliance of an enterprise. Presents cyber risks to the Board of Directors and aligns security investments with business objectives.",
        "min_years_experience": 10.0,
        "required_skills": ["Information Security Strategy", "Risk Management", "ISO 27001", "SOC 2", "Executive Leadership", "Budgeting"],
        "icon_type": "leadership",
        "candidates_count": 8,
        "top_match_score": 97,
        "posted_date": "2026-01-10",
        "status": "OPEN",
    },

    # 5. Software Engineering & Digital Design
    {
        "id": "job-031",
        "title": "Full-Stack Developer",
        "department": "Software Engineering",
        "location": "Remote",
        "job_description": "Handles both visual frontend interfaces and server-side backend product logic. Develops end-to-end features, data schemas, REST/GraphQL APIs, and responsive web components.",
        "min_years_experience": 3.0,
        "required_skills": ["React", "Node.js", "TypeScript", "PostgreSQL", "REST APIs", "Tailwind CSS", "Docker"],
        "icon_type": "code",
        "candidates_count": 52,
        "top_match_score": 95,
        "posted_date": "2026-02-15",
        "status": "OPEN",
    },
    {
        "id": "job-032",
        "title": "Backend Developer",
        "department": "Software Engineering",
        "location": "Remote / San Francisco",
        "job_description": "Architects data storage, server logic, and robust APIs that power applications. Focuses on concurrency, database indexing, caching strategies, and resilient microservice communication.",
        "min_years_experience": 3.0,
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Redis", "Microservices", "REST/gRPC", "Docker"],
        "icon_type": "code",
        "candidates_count": 46,
        "top_match_score": 94,
        "posted_date": "2026-02-12",
        "status": "OPEN",
    },
    {
        "id": "job-033",
        "title": "Frontend Developer",
        "department": "Software Engineering",
        "location": "Remote / New York",
        "job_description": "Codes user-facing web interfaces using frameworks like React, Vue, or Angular. Champions responsive layouts, accessibility (WCAG), state management, and modern CSS architecture.",
        "min_years_experience": 3.0,
        "required_skills": ["React", "TypeScript", "Next.js", "CSS/Tailwind", "Web Performance", "State Management"],
        "icon_type": "code",
        "candidates_count": 41,
        "top_match_score": 92,
        "posted_date": "2026-02-08",
        "status": "OPEN",
    },
    {
        "id": "job-034",
        "title": "Mobile App Developer",
        "department": "Software Engineering",
        "location": "Remote / Los Angeles",
        "job_description": "Creates native or cross-platform applications for iOS and Android devices. Builds responsive mobile user interfaces, offline data sync, push notifications, and App Store releases.",
        "min_years_experience": 3.0,
        "required_skills": ["React Native", "Flutter", "Swift", "Kotlin", "Mobile UX", "App Store Deployment"],
        "icon_type": "code",
        "candidates_count": 29,
        "top_match_score": 90,
        "posted_date": "2026-02-05",
        "status": "OPEN",
    },
    {
        "id": "job-035",
        "title": "Embedded Systems Engineer",
        "department": "Software Engineering",
        "location": "San Jose / Hybrid",
        "job_description": "Writes software for physical hardware like IoT chips, automotive sensors, and smart appliances. Develops low-level firmware, driver interfaces, and real-time operating system tasks.",
        "min_years_experience": 4.0,
        "required_skills": ["C", "C++", "RTOS", "Microcontrollers (ARM/STM32)", "Hardware Protocols (I2C/SPI/UART)", "Firmware"],
        "icon_type": "emerging",
        "candidates_count": 16,
        "top_match_score": 88,
        "posted_date": "2026-01-31",
        "status": "OPEN",
    },
    {
        "id": "job-036",
        "title": "API Engineer",
        "department": "Software Engineering",
        "location": "Remote",
        "job_description": "Specializes in designing, documenting, and securing microservices communication channels. Implements API gateways, rate limiting, OpenAPI specifications, and developer documentation.",
        "min_years_experience": 4.0,
        "required_skills": ["OpenAPI/Swagger", "gRPC", "GraphQL", "REST", "Rate Limiting", "API Gateways", "Kong"],
        "icon_type": "code",
        "candidates_count": 22,
        "top_match_score": 91,
        "posted_date": "2026-01-26",
        "status": "OPEN",
    },
    {
        "id": "job-037",
        "title": "UI/UX Designer",
        "department": "Software Engineering",
        "location": "London / Remote",
        "job_description": "Conducts user research and creates intuitive interfaces to optimize digital products. Develops design systems, interactive prototypes, user journey maps, and conducts usability testing.",
        "min_years_experience": 3.0,
        "required_skills": ["Figma", "UI/UX Design", "User Research", "Prototyping", "Wireframing", "Design Systems"],
        "icon_type": "design",
        "candidates_count": 37,
        "top_match_score": 93,
        "posted_date": "2026-01-20",
        "status": "OPEN",
    },

    # 6. Quality Assurance, Automation & Support
    {
        "id": "job-038",
        "title": "QA Automation Engineer",
        "department": "Quality Assurance & Support",
        "location": "Remote",
        "job_description": "Writes test scripts to automatically find bugs and check software performance. Creates end-to-end regression suites, performance benchmarks, and CI/CD automated test gates.",
        "min_years_experience": 3.0,
        "required_skills": ["Cypress", "Playwright", "Selenium", "Python", "TypeScript", "CI/CD Test Automation", "TestNG"],
        "icon_type": "qa",
        "candidates_count": 30,
        "top_match_score": 92,
        "posted_date": "2026-02-11",
        "status": "OPEN",
    },
    {
        "id": "job-039",
        "title": "Manual QA Tester",
        "department": "Quality Assurance & Support",
        "location": "Remote",
        "job_description": "Visually tests software workflows to catch usability issues from a human perspective. Designs comprehensive test plans, executes exploratory test rounds, and logs detailed reproduction steps in Jira.",
        "min_years_experience": 2.0,
        "required_skills": ["Manual Testing", "Test Case Design", "Bug Tracking (Jira)", "Usability Testing", "Exploratory Testing"],
        "icon_type": "qa",
        "candidates_count": 25,
        "top_match_score": 86,
        "posted_date": "2026-02-06",
        "status": "OPEN",
    },
    {
        "id": "job-040",
        "title": "IT Support Specialist (Help Desk)",
        "department": "Quality Assurance & Support",
        "location": "Chicago / On-site",
        "job_description": "Troubleshoots everyday hardware, software, and access issues for employees or clients. Configures workstations, resolves ticket escalations, and manages endpoint software deployment.",
        "min_years_experience": 1.0,
        "required_skills": ["Technical Support", "Jira Service Management", "macOS/Windows Troubleshooting", "Hardware Setup", "Customer Service"],
        "icon_type": "qa",
        "candidates_count": 32,
        "top_match_score": 84,
        "posted_date": "2026-01-29",
        "status": "OPEN",
    },
    {
        "id": "job-041",
        "title": "Technical Writer",
        "department": "Quality Assurance & Support",
        "location": "Remote",
        "job_description": "Drafts developer documentation, user manuals, and API guides for technical clarity. Maintains docs-as-code repos, architecture diagrams, and onboarding guides for engineering teams.",
        "min_years_experience": 2.0,
        "required_skills": ["API Documentation", "Markdown", "Git", "Technical Communication", "Docs-as-Code", "SDK Guides"],
        "icon_type": "qa",
        "candidates_count": 14,
        "top_match_score": 89,
        "posted_date": "2026-01-23",
        "status": "OPEN",
    },

    # 7. Tech Leadership, Product & Business Strategy
    {
        "id": "job-042",
        "title": "Product Manager",
        "department": "Tech Leadership & Strategy",
        "location": "San Francisco / Hybrid",
        "job_description": "Defines the long-term vision, features, and release roadmap of software products. Gathers user requirements, prioritizes backlogs, and aligns cross-functional engineering and go-to-market teams.",
        "min_years_experience": 4.0,
        "required_skills": ["Product Strategy", "Roadmap Planning", "User Story Mapping", "Agile/Scrum", "Data Analysis", "Feature Prioritization"],
        "icon_type": "product",
        "candidates_count": 44,
        "top_match_score": 95,
        "posted_date": "2026-02-14",
        "status": "OPEN",
    },
    {
        "id": "job-043",
        "title": "Scrum Master / Agile Coach",
        "department": "Tech Leadership & Strategy",
        "location": "Remote",
        "job_description": "Facilitates team workflows, removes blockers, and speeds up product delivery cycles. Leads sprint planning, retrospectives, and coaches engineering teams in Agile best practices.",
        "min_years_experience": 4.0,
        "required_skills": ["Scrum", "Kanban", "Agile Coaching", "Jira", "Sprint Facilitation", "Continuous Improvement"],
        "icon_type": "leadership",
        "candidates_count": 21,
        "top_match_score": 88,
        "posted_date": "2026-02-07",
        "status": "OPEN",
    },
    {
        "id": "job-044",
        "title": "Technical Project Manager (TPM)",
        "department": "Tech Leadership & Strategy",
        "location": "Seattle / Hybrid",
        "job_description": "Manages engineering timelines, resource budgets, and cross-team dependencies. Drives complex technical deliveries from conception through launch with precise risk management.",
        "min_years_experience": 5.0,
        "required_skills": ["Technical Project Management", "Timeline Estimation", "Risk Management", "Cross-team Coordination", "Resource Planning"],
        "icon_type": "leadership",
        "candidates_count": 28,
        "top_match_score": 91,
        "posted_date": "2026-02-01",
        "status": "OPEN",
    },
    {
        "id": "job-045",
        "title": "Enterprise Architect",
        "department": "Tech Leadership & Strategy",
        "location": "New York / Hybrid",
        "job_description": "Strategizes the overarching tech ecosystem to align IT capabilities with business goals. Evaluates emerging technologies, governs enterprise standards, and guides long-term cloud transformation.",
        "min_years_experience": 9.0,
        "required_skills": ["Enterprise Architecture", "TOGAF", "Cloud Modernization", "Legacy Integration", "Strategic Planning", "Governance"],
        "icon_type": "leadership",
        "candidates_count": 12,
        "top_match_score": 93,
        "posted_date": "2026-01-25",
        "status": "OPEN",
    },
    {
        "id": "job-046",
        "title": "IT Business Analyst",
        "department": "Tech Leadership & Strategy",
        "location": "Remote / Boston",
        "job_description": "Evaluates company processes to determine technological solutions for operational problems. Documents business requirements, models workflows (BPMN), and performs gap analysis.",
        "min_years_experience": 3.0,
        "required_skills": ["Business Requirements Analysis", "Process Mapping", "BPMN", "SQL", "Stakeholder Management", "Gap Analysis"],
        "icon_type": "leadership",
        "candidates_count": 23,
        "top_match_score": 87,
        "posted_date": "2026-01-18",
        "status": "OPEN",
    },
    {
        "id": "job-047",
        "title": "Chief Technology Officer (CTO)",
        "department": "Tech Leadership & Strategy",
        "location": "San Francisco / Executive",
        "job_description": "Outlines the macro technology strategy and drives innovation across the entire organization. Mentors engineering leaders, oversees technical due diligence, and steers technical vision.",
        "min_years_experience": 12.0,
        "required_skills": ["Technology Strategy", "Executive Leadership", "Architecture Governance", "Talent Building", "R&D", "Venture Strategy"],
        "icon_type": "leadership",
        "candidates_count": 9,
        "top_match_score": 98,
        "posted_date": "2026-01-12",
        "status": "OPEN",
    },

    # 8. Specialized & Emerging Domains
    {
        "id": "job-048",
        "title": "IoT Engineer",
        "department": "Specialized & Emerging Domains",
        "location": "Austin, TX / Hybrid",
        "job_description": "Develops and connects smart networks of physical sensors, edge devices, and cloud backends. Implements MQTT telemetry pipelines, edge compute models, and device fleet security.",
        "min_years_experience": 4.0,
        "required_skills": ["IoT Protocols (MQTT/CoAP)", "Edge Computing", "AWS IoT / Azure IoT", "Microcontrollers", "Python/C++", "Device Provisioning"],
        "icon_type": "emerging",
        "candidates_count": 18,
        "top_match_score": 91,
        "posted_date": "2026-02-10",
        "status": "OPEN",
    },
    {
        "id": "job-049",
        "title": "RPA Developer",
        "department": "Specialized & Emerging Domains",
        "location": "Remote",
        "job_description": "Builds robotic process automation bots to handle repetitive, manual office tasks. Automates multi-application workflows, OCR document extraction, and desktop automation.",
        "min_years_experience": 3.0,
        "required_skills": ["UiPath", "Automation Anywhere", "Process Automation", "VB.NET/C#", "Workflow Orchestration", "OCR"],
        "icon_type": "emerging",
        "candidates_count": 22,
        "top_match_score": 89,
        "posted_date": "2026-02-04",
        "status": "OPEN",
    },
    {
        "id": "job-050",
        "title": "Salesforce / CRM Administrator",
        "department": "Specialized & Emerging Domains",
        "location": "Remote / Dallas",
        "job_description": "Optimizes and configures customer relationship management software to match sales pipelines. Builds custom Flow automations, user permissions, object schemas, and sales reports.",
        "min_years_experience": 3.0,
        "required_skills": ["Salesforce Administration", "Flow Automation", "Apex Basics", "CRM Customization", "User Roles & Security", "Reports & Dashboards"],
        "icon_type": "emerging",
        "candidates_count": 31,
        "top_match_score": 90,
        "posted_date": "2026-01-28",
        "status": "OPEN",
    },
]

# Populate in-memory store
JOBS_STORE: Dict[str, Dict[str, Any]] = {}
for i, item in enumerate(RAW_50_JOBS):
    job_id = item["id"]
    avatar_slice = SAMPLE_AVATARS[i % len(SAMPLE_AVATARS): (i % len(SAMPLE_AVATARS)) + 3]
    if len(avatar_slice) < 3:
        avatar_slice = SAMPLE_AVATARS[:3]

    JOBS_STORE[job_id] = {
        "id": job_id,
        "title": item["title"],
        "department": item["department"],
        "location": item["location"],
        "status": item["status"],
        "posted_date": item["posted_date"],
        "candidates_count": item["candidates_count"],
        "avatars": avatar_slice,
        "top_match": {
            "score": item["top_match_score"],
            "label": f"{item['top_match_score']} Top Match",
            "last_run": "2h ago",
            "status": "ACTIVE" if item["status"] == "OPEN" else "PAUSED"
        },
        "icon_type": item["icon_type"],
        "job_description": item["job_description"],
        "min_years_experience": item["min_years_experience"],
        "required_skills": item["required_skills"],
        "structured_criteria": {
            "technical_depth_weight": 0.4,
            "domain_expertise_weight": 0.4,
            "execution_weight": 0.2
        },
        "created_at": f"{item['posted_date']}T09:00:00Z",
        "updated_at": f"{item['posted_date']}T09:00:00Z"
    }


class CreateJobRequest(BaseModel):
    title: str = Field(..., description="Job Requisition Title")
    department: str = Field(default="Software Engineering", description="Department name")
    location: str = Field(default="Remote", description="Job location")
    job_description: str = Field(..., description="Full text or HTML job description")
    required_skills: List[str] = Field(default_factory=list, description="Extracted required skills")
    min_years_experience: float = Field(default=3.0, description="Minimum years of experience")
    run_ai_match: bool = Field(default=True, description="Whether to trigger candidate matching")


class JobResponse(BaseModel):
    id: str
    title: str
    department: str
    location: str
    status: str
    posted_date: str
    candidates_count: int
    avatars: List[str]
    top_match: Dict[str, Any]
    icon_type: str
    job_description: str
    min_years_experience: float
    required_skills: List[str]
    structured_criteria: Dict[str, Any]
    created_at: str
    updated_at: str


@router.get("", response_model=List[JobResponse])
async def list_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    jobs = list(JOBS_STORE.values())

    if status_filter and status_filter.upper() != "ALL":
        jobs = [j for j in jobs if j["status"].upper() == status_filter.upper()]

    if department and department.upper() != "ALL":
        dept_query = department.lower()
        jobs = [
            j for j in jobs
            if dept_query in j["department"].lower() or j["department"].lower() in dept_query
        ]

    if search:
        s = search.lower()
        jobs = [
            j for j in jobs
            if s in j["title"].lower()
            or s in j["department"].lower()
            or s in j["location"].lower()
            or any(s in skill.lower() for skill in j.get("required_skills", []))
        ]

    return jobs


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    if job_id not in JOBS_STORE:
        # Check by prefix match or index
        matched = [j for j in JOBS_STORE.values() if j["id"] == job_id or j["title"].lower() == job_id.lower()]
        if matched:
            return matched[0]
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JOBS_STORE[job_id]


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(payload: CreateJobRequest):
    new_id = f"job-{uuid.uuid4().hex[:8]}"
    now_str = datetime.utcnow().strftime("%Y-%m-%d")
    now_iso = datetime.utcnow().isoformat() + "Z"

    # Auto-extract skills if none provided
    skills = payload.required_skills
    if not skills:
        common_keywords = ["Python", "FastAPI", "PostgreSQL", "Kubernetes", "AWS", "React", "TypeScript", "Docker", "PyTorch", "LLMs"]
        skills = [kw for kw in common_keywords if kw.lower() in payload.job_description.lower()] or ["Python", "FastAPI", "PostgreSQL"]

    icon_type = "code"
    dept_lower = payload.department.lower()
    if "ai" in dept_lower or "intelligent" in dept_lower or "machine learning" in dept_lower:
        icon_type = "ai"
    elif "cloud" in dept_lower or "infrastructure" in dept_lower or "devops" in dept_lower:
        icon_type = "cloud"
    elif "data" in dept_lower or "analytics" in dept_lower:
        icon_type = "database"
    elif "security" in dept_lower or "cyber" in dept_lower:
        icon_type = "security"
    elif "qa" in dept_lower or "quality" in dept_lower or "support" in dept_lower:
        icon_type = "qa"
    elif "leadership" in dept_lower or "strategy" in dept_lower:
        icon_type = "leadership"
    elif "design" in dept_lower or "ux" in dept_lower:
        icon_type = "design"
    elif "product" in dept_lower:
        icon_type = "product"
    elif "emerging" in dept_lower or "iot" in dept_lower or "specialized" in dept_lower:
        icon_type = "emerging"

    new_job = {
        "id": new_id,
        "title": payload.title,
        "department": payload.department,
        "location": payload.location,
        "status": "OPEN",
        "posted_date": now_str,
        "candidates_count": 0,
        "avatars": [],
        "top_match": {
            "score": 95 if payload.run_ai_match else 0,
            "label": "95 Top Match" if payload.run_ai_match else "Pending Match",
            "last_run": "Just now" if payload.run_ai_match else "-",
            "status": "ACTIVE"
        },
        "icon_type": icon_type,
        "job_description": payload.job_description,
        "min_years_experience": payload.min_years_experience,
        "required_skills": skills,
        "structured_criteria": {
            "technical_depth_weight": 0.4,
            "domain_expertise_weight": 0.4,
            "execution_weight": 0.2
        },
        "created_at": now_iso,
        "updated_at": now_iso
    }

    JOBS_STORE[new_id] = new_job
    return new_job


@router.patch("/{job_id}/status", response_model=JobResponse)
async def update_job_status(job_id: str, new_status: str = Query(..., pattern="^(OPEN|PAUSED|CLOSED)$")):
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    JOBS_STORE[job_id]["status"] = new_status
    if new_status == "PAUSED":
        JOBS_STORE[job_id]["top_match"]["status"] = "PAUSED"
        JOBS_STORE[job_id]["top_match"]["label"] = "Analysis Paused"
    elif new_status == "OPEN":
        JOBS_STORE[job_id]["top_match"]["status"] = "ACTIVE"

    return JOBS_STORE[job_id]
