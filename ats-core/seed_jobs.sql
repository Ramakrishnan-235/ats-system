-- seed_jobs.sql
-- Inserts 50 curated tech job postings into the job_postings table

INSERT INTO job_postings (id, title, department, location, job_description, min_years_experience, required_skills, status, structured_criteria)
VALUES
-- 1. AI, Machine Learning & Intelligent Systems
(
    'a1000001-0000-0000-0000-000000000001',
    'Generative AI Developer',
    'AI & Intelligent Systems',
    'Remote / San Francisco',
    'Builds applications using LLMs, prompt frameworks, and vector databases. Designs retrieval-augmented generation (RAG) pipelines, fine-tunes embeddings, and integrates cutting-edge foundation models into production systems.',
    3.0,
    ARRAY['LLMs', 'LangChain', 'LlamaIndex', 'Vector Databases', 'Prompt Engineering', 'Python', 'RAG', 'Embeddings'],
    'OPEN',
    '{"llm_engineering_weight": 0.4, "rag_architecture_weight": 0.4, "python_weight": 0.2}'::jsonb
),
(
    'a1000001-0000-0000-0000-000000000002',
    'AI/ML Engineer',
    'AI & Intelligent Systems',
    'New York / Hybrid',
    'Designs and develops core machine learning models and predictive algorithms. Trains, optimizes, and evaluates statistical and deep learning architectures for enterprise workloads.',
    4.0,
    ARRAY['PyTorch', 'TensorFlow', 'Scikit-learn', 'Python', 'Machine Learning', 'Predictive Modeling', 'Deep Learning', 'MLOps'],
    'OPEN',
    '{"model_training_weight": 0.4, "deep_learning_weight": 0.4, "math_stats_weight": 0.2}'::jsonb
),
(
    'a1000001-0000-0000-0000-000000000003',
    'MLOps Engineer',
    'AI & Intelligent Systems',
    'Remote',
    'Deploys, monitors, and manages the lifecycle of machine learning pipelines. Establishes automated CI/CD for ML models, drift detection, feature stores, and containerized GPU serving.',
    4.0,
    ARRAY['MLflow', 'Kubeflow', 'Docker', 'Kubernetes', 'CI/CD', 'Model Monitoring', 'Python', 'Feature Stores'],
    'OPEN',
    '{"pipeline_automation_weight": 0.5, "kubernetes_weight": 0.3, "monitoring_weight": 0.2}'::jsonb
),
(
    'a1000001-0000-0000-0000-000000000004',
    'NLP Engineer',
    'AI & Intelligent Systems',
    'Boston / Remote',
    'Specializes in machine comprehension of human language, chatbots, and translation systems. Implements transformer models, tokenization pipelines, sentiment analysis, and NER.',
    3.0,
    ARRAY['NLP', 'Hugging Face', 'Transformers', 'NLTK', 'Spacy', 'Python', 'Text Processing', 'Tokenization'],
    'OPEN',
    '{"nlp_depth_weight": 0.5, "transformer_fine_tuning_weight": 0.3, "python_weight": 0.2}'::jsonb
),
(
    'a1000001-0000-0000-0000-000000000005',
    'Computer Vision Engineer',
    'AI & Intelligent Systems',
    'Seattle / Hybrid',
    'Processes visual data for autonomous systems, robotics, and facial recognition. Develops real-time object detection, segmentation, and 3D point cloud processing pipelines.',
    4.0,
    ARRAY['OpenCV', 'YOLO', 'PyTorch', 'Image Processing', 'Object Detection', 'C++', 'Python', 'CUDA'],
    'OPEN',
    '{"cv_algorithms_weight": 0.5, "deep_learning_vision_weight": 0.3, "cuda_optimization_weight": 0.2}'::jsonb
),
(
    'a1000001-0000-0000-0000-000000000006',
    'AI Product Manager',
    'AI & Intelligent Systems',
    'San Francisco, CA',
    'Bridges technical AI development teams with business strategy and user needs. Translates generative AI and machine learning capabilities into high-impact user experiences and measurable business metrics.',
    4.0,
    ARRAY['AI Product Strategy', 'Model Evaluation', 'User Experience', 'Roadmapping', 'Agile', 'Cross-functional Leadership'],
    'OPEN',
    '{"ai_strategy_weight": 0.5, "product_execution_weight": 0.3, "leadership_weight": 0.2}'::jsonb
),
(
    'a1000001-0000-0000-0000-000000000007',
    'Data Labeling & Annotation Specialist',
    'AI & Intelligent Systems',
    'Remote',
    'Curates, cleans, and structures training datasets for high-performance AI models. Establishes gold-standard annotation guidelines, multi-modal labelling workflows, and active learning validation.',
    1.0,
    ARRAY['Data Annotation', 'Quality Assurance', 'CVAT', 'Label Studio', 'Dataset Curation', 'Data Cleaning'],
    'OPEN',
    '{"data_accuracy_weight": 0.6, "annotation_tooling_weight": 0.4}'::jsonb
),
(
    'a1000001-0000-0000-0000-000000000008',
    'AI Ethics & Compliance Officer',
    'AI & Intelligent Systems',
    'Washington, DC / Remote',
    'Ensures corporate AI applications adhere to legal, fairness, and safety standards. Conducts algorithmic bias auditing, regulatory impact assessments (EU AI Act, NIST AI RMF), and responsible AI guidelines.',
    5.0,
    ARRAY['AI Governance', 'Compliance', 'Bias Auditing', 'Risk Assessment', 'GDPR', 'Responsible AI'],
    'OPEN',
    '{"regulatory_compliance_weight": 0.5, "bias_auditing_weight": 0.3, "ethics_frameworks_weight": 0.2}'::jsonb
),

-- 2. Cloud, DevOps & Infrastructure
(
    'a1000002-0000-0000-0000-000000000009',
    'Cloud Architect',
    'Cloud & Infrastructure',
    'Remote / Austin, TX',
    'Designs overarching cloud strategy, migration plans, and multi-cloud architectures. Optimizes cloud cost, reliability, security, and hybrid-cloud topologies.',
    7.0,
    ARRAY['AWS', 'Azure', 'GCP', 'Cloud Architecture', 'Terraform', 'Well-Architected Framework', 'Microservices'],
    'OPEN',
    '{"architecture_design_weight": 0.5, "multi_cloud_weight": 0.3, "cost_resilience_weight": 0.2}'::jsonb
),
(
    'a1000002-0000-0000-0000-000000000010',
    'Cloud Engineer',
    'Cloud & Infrastructure',
    'Denver, CO / Hybrid',
    'Manages everyday infrastructure deployment and provisioning across AWS, Azure, or GCP. Builds automated serverless and containerized cloud resources.',
    3.0,
    ARRAY['AWS', 'Azure', 'Linux', 'Terraform', 'CloudFormation', 'Networking', 'Docker'],
    'OPEN',
    '{"cloud_provisioning_weight": 0.4, "terraform_weight": 0.4, "linux_networking_weight": 0.2}'::jsonb
),
(
    'a1000002-0000-0000-0000-000000000011',
    'DevOps Engineer',
    'Cloud & Infrastructure',
    'Remote',
    'Builds automated CI/CD pipelines to bridge software development and IT operations. Implements infrastructure as code, release automation, and environment consistency.',
    4.0,
    ARRAY['Jenkins', 'GitHub Actions', 'Docker', 'Kubernetes', 'CI/CD', 'Bash', 'Ansible', 'Git'],
    'OPEN',
    '{"ci_cd_pipelines_weight": 0.4, "containerization_weight": 0.4, "scripting_weight": 0.2}'::jsonb
),
(
    'a1000002-0000-0000-0000-000000000012',
    'Platform Engineer',
    'Cloud & Infrastructure',
    'San Francisco / Remote',
    'Designs and maintains internal developer platforms (IDPs) to speed up coding workflows. Provides self-service tooling, Golden Paths, and standardized runtime environments for product engineering.',
    5.0,
    ARRAY['Kubernetes', 'Terraform', 'Backstage', 'GitOps', 'Helm', 'Developer Tooling', 'Golang'],
    'OPEN',
    '{"idp_tooling_weight": 0.4, "kubernetes_gitops_weight": 0.4, "developer_experience_weight": 0.2}'::jsonb
),
(
    'a1000002-0000-0000-0000-000000000013',
    'Site Reliability Engineer (SRE)',
    'Cloud & Infrastructure',
    'Remote / New York',
    'Focuses on system availability, automation, and large-scale infrastructure resilience. Implements SLOs/SLAs, distributed tracing, automated incident remediation, and blameless post-mortems.',
    5.0,
    ARRAY['SRE', 'Prometheus', 'Grafana', 'Distributed Systems', 'Incident Management', 'Python', 'Chaos Engineering'],
    'OPEN',
    '{"reliability_automation_weight": 0.5, "observability_weight": 0.3, "incident_response_weight": 0.2}'::jsonb
),
(
    'a1000002-0000-0000-0000-000000000014',
    'Network Architect',
    'Cloud & Infrastructure',
    'Dallas, TX',
    'Designs high-performance local, wide-area, and cloud-integrated enterprise communication networks. Configures SD-WAN, BGP peering, and multi-cloud interconnects.',
    8.0,
    ARRAY['BGP', 'OSPF', 'SD-WAN', 'Cloud Interconnects', 'Network Design', 'VPN', 'Cisco / Juniper'],
    'OPEN',
    '{"network_architecture_weight": 0.6, "routing_protocols_weight": 0.4}'::jsonb
),
(
    'a1000002-0000-0000-0000-000000000015',
    'Network Engineer',
    'Cloud & Infrastructure',
    'Chicago, IL',
    'Installs, configures, and maintains physical and virtual network hardware and routing systems. Troubleshoots routing protocols, firewall rules, and enterprise switches.',
    3.0,
    ARRAY['Routing & Switching', 'Firewalls', 'VLANs', 'TCP/IP', 'DNS', 'Wireshark', 'Troubleshooting'],
    'OPEN',
    '{"switching_routing_weight": 0.5, "firewall_security_weight": 0.3, "troubleshooting_weight": 0.2}'::jsonb
),
(
    'a1000002-0000-0000-0000-000000000016',
    'Systems Administrator',
    'Cloud & Infrastructure',
    'Atlanta, GA',
    'Manages local servers, operating systems, hardware setups, and core digital office infrastructure. Maintains virtualized clusters, directory services, and system patch management.',
    3.0,
    ARRAY['Linux', 'Windows Server', 'Active Directory', 'VMware', 'Bash/PowerShell', 'Backup Recovery'],
    'OPEN',
    '{"os_management_weight": 0.4, "virtualization_weight": 0.3, "identity_services_weight": 0.3}'::jsonb
),

-- 3. Data Science, Analytics & Big Data
(
    'a1000003-0000-0000-0000-000000000017',
    'Data Scientist',
    'Data Science & Analytics',
    'Remote / New York',
    'Combines statistics, programming, and modeling to extract business value and build predictive logic. Performs exploratory data analysis, hypothesis testing, and algorithmic feature engineering.',
    3.0,
    ARRAY['Python', 'R', 'Statistical Modeling', 'Machine Learning', 'SQL', 'Data Visualization', 'Pandas'],
    'OPEN',
    '{"statistics_modeling_weight": 0.4, "python_sql_weight": 0.4, "business_insights_weight": 0.2}'::jsonb
),
(
    'a1000003-0000-0000-0000-000000000018',
    'Data Engineer',
    'Data Science & Analytics',
    'San Francisco / Hybrid',
    'Creates data pipelines, architecture, and ETL systems to process massive datasets. Designs scalable batch and streaming data pipelines with workflow orchestrators.',
    4.0,
    ARRAY['Apache Spark', 'Airflow', 'SQL', 'Python', 'ETL Pipelines', 'Snowflake', 'Data Lakehouse'],
    'OPEN',
    '{"etl_pipelines_weight": 0.5, "spark_streaming_weight": 0.3, "data_warehousing_weight": 0.2}'::jsonb
),
(
    'a1000003-0000-0000-0000-000000000019',
    'Analytics Engineer',
    'Data Science & Analytics',
    'Remote',
    'Prepares, cleans, and structures data within warehouses for seamless business analysis. Writes version-controlled transformation models using dbt and modern data warehouse techniques.',
    3.0,
    ARRAY['dbt', 'SQL', 'BigQuery', 'Snowflake', 'Data Modeling', 'Git', 'Metabase'],
    'OPEN',
    '{"dbt_modeling_weight": 0.5, "sql_depth_weight": 0.3, "data_governance_weight": 0.2}'::jsonb
),
(
    'a1000003-0000-0000-0000-000000000020',
    'Business Intelligence (BI) Analyst',
    'Data Science & Analytics',
    'Chicago / Remote',
    'Translates structured data into actionable executive dashboards and corporate reports. Partners with business leaders to track core KPIs, revenue drivers, and operational metrics.',
    2.0,
    ARRAY['Power BI', 'Tableau', 'Advanced SQL', 'DAX', 'Dashboard Design', 'KPI Reporting'],
    'OPEN',
    '{"bi_visualization_weight": 0.5, "sql_analytics_weight": 0.3, "business_acumen_weight": 0.2}'::jsonb
),
(
    'a1000003-0000-0000-0000-000000000021',
    'Big Data Architect',
    'Data Science & Analytics',
    'Seattle, WA',
    'Designs large-scale data storage and compute environments using tools like Hadoop or Spark. Implements high-throughput distributed ingestion and lakehouse architecture.',
    7.0,
    ARRAY['Hadoop', 'Apache Spark', 'Kafka', 'Distributed Computing', 'Delta Lake', 'Architecture Design'],
    'OPEN',
    '{"big_data_architecture_weight": 0.5, "distributed_systems_weight": 0.3, "scalability_weight": 0.2}'::jsonb
),
(
    'a1000003-0000-0000-0000-000000000022',
    'Database Administrator (DBA)',
    'Data Science & Analytics',
    'Remote / Phoenix',
    'Manages, protects, and tunes the performance of relational and non-relational databases. Leads indexing optimization, high availability clustering, replication, and backup disaster recovery.',
    5.0,
    ARRAY['PostgreSQL', 'MySQL', 'Query Optimization', 'Database Replication', 'Backup & Recovery', 'Index Tuning'],
    'OPEN',
    '{"dba_performance_weight": 0.5, "backup_recovery_weight": 0.3, "high_availability_weight": 0.2}'::jsonb
),
(
    'a1000003-0000-0000-0000-000000000023',
    'Data Governance Specialist',
    'Data Science & Analytics',
    'New York, NY',
    'Enforces corporate data policies, privacy standards, and data cataloging rules. Maintains data lineage, metadata definitions, and compliance with privacy regulations.',
    4.0,
    ARRAY['Data Governance', 'Collibra', 'GDPR/CCPA Compliance', 'Data Lineage', 'Metadata Management', 'Data Quality'],
    'OPEN',
    '{"governance_frameworks_weight": 0.5, "compliance_privacy_weight": 0.3, "data_catalog_weight": 0.2}'::jsonb
),

-- 4. Cybersecurity & Risk Management
(
    'a1000004-0000-0000-0000-000000000024',
    'Cybersecurity Analyst',
    'Cybersecurity & Risk',
    'Remote / Washington, DC',
    'Monitors corporate networks for active threats and mitigates digital security breaches. Analyzes SIEM alerts, triages suspicious network anomalies, and enforces defense-in-depth controls.',
    2.0,
    ARRAY['SIEM', 'Incident Response', 'Network Security', 'Threat Hunting', 'Log Analysis', 'Firewalls'],
    'OPEN',
    '{"siem_monitoring_weight": 0.4, "incident_triage_weight": 0.4, "network_security_weight": 0.2}'::jsonb
),
(
    'a1000004-0000-0000-0000-000000000025',
    'Ethical Hacker / Penetration Tester',
    'Cybersecurity & Risk',
    'Remote',
    'Proactively attacks internal networks to discover and patch structural vulnerabilities. Performs authorized red-team engagements, exploit chaining, and web/network penetration testing.',
    4.0,
    ARRAY['Penetration Testing', 'Metasploit', 'Burp Suite', 'Vulnerability Assessment', 'Kali Linux', 'Exploit Development'],
    'OPEN',
    '{"penetration_testing_weight": 0.5, "vulnerability_research_weight": 0.3, "red_teaming_weight": 0.2}'::jsonb
),
(
    'a1000004-0000-0000-0000-000000000026',
    'Application Security Engineer',
    'Cybersecurity & Risk',
    'San Francisco / Remote',
    'Ensures that custom software code and APIs are secure before deployment. Embeds SAST/DAST into CI/CD pipelines, performs threat modeling, and trains developers in secure coding practices.',
    4.0,
    ARRAY['AppSec', 'OWASP Top 10', 'SAST/DAST', 'Threat Modeling', 'Secure Code Review', 'API Security'],
    'OPEN',
    '{"appsec_sast_dast_weight": 0.5, "threat_modeling_weight": 0.3, "code_review_weight": 0.2}'::jsonb
),
(
    'a1000004-0000-0000-0000-000000000027',
    'Cloud Security Specialist',
    'Cybersecurity & Risk',
    'Remote / Seattle',
    'Focuses entirely on securing cloud architecture, access keys, and virtual networks. Implements Cloud Security Posture Management (CSPM), identity boundaries, and automated compliance policies.',
    4.0,
    ARRAY['AWS Security', 'IAM', 'Cloud Custodian', 'CSPM', 'GuardDuty', 'Zero Trust', 'Compliance'],
    'OPEN',
    '{"cloud_security_weight": 0.5, "iam_boundaries_weight": 0.3, "cspm_automation_weight": 0.2}'::jsonb
),
(
    'a1000004-0000-0000-0000-000000000028',
    'Identity and Access Management (IAM) Engineer',
    'Cybersecurity & Risk',
    'Remote',
    'Controls user permissions, single sign-on (SSO), and digital identity authentication. Implements zero-trust access control, privilege management, and directory federations.',
    4.0,
    ARRAY['Okta', 'Ping Identity', 'SAML', 'OAuth 2.0 / OIDC', 'Active Directory', 'Zero Trust Architecture'],
    'OPEN',
    '{"iam_protocols_weight": 0.5, "sso_federation_weight": 0.3, "zero_trust_weight": 0.2}'::jsonb
),
(
    'a1000004-0000-0000-0000-000000000029',
    'Security Operations Center (SOC) Manager',
    'Cybersecurity & Risk',
    'Austin, TX / Hybrid',
    'Leads the real-time threat incident response team and defensive strategy. Oversees 24/7 detection, threat hunting operations, runbook automation, and executive breach escalation.',
    6.0,
    ARRAY['SOC Leadership', 'Incident Response', 'SIEM', 'Threat Intelligence', 'Team Management', 'Forensic Analysis'],
    'OPEN',
    '{"soc_management_weight": 0.5, "incident_response_weight": 0.3, "threat_intelligence_weight": 0.2}'::jsonb
),
(
    'a1000004-0000-0000-0000-000000000030',
    'Chief Information Security Officer (CISO)',
    'Cybersecurity & Risk',
    'New York / Executive',
    'Directs the entire cybersecurity vision, risk budgeting, and security compliance of an enterprise. Presents cyber risks to the Board of Directors and aligns security investments with business objectives.',
    10.0,
    ARRAY['Information Security Strategy', 'Risk Management', 'ISO 27001', 'SOC 2', 'Executive Leadership', 'Budgeting'],
    'OPEN',
    '{"executive_leadership_weight": 0.4, "risk_governance_weight": 0.4, "security_strategy_weight": 0.2}'::jsonb
),

-- 5. Software Engineering & Digital Design
(
    'a1000005-0000-0000-0000-000000000031',
    'Full-Stack Developer',
    'Software Engineering',
    'Remote',
    'Handles both visual frontend interfaces and server-side backend product logic. Develops end-to-end features, data schemas, REST/GraphQL APIs, and responsive web components.',
    3.0,
    ARRAY['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'REST APIs', 'Tailwind CSS', 'Docker'],
    'OPEN',
    '{"fullstack_breadth_weight": 0.4, "frontend_react_weight": 0.3, "backend_node_weight": 0.3}'::jsonb
),
(
    'a1000005-0000-0000-0000-000000000032',
    'Backend Developer',
    'Software Engineering',
    'Remote / San Francisco',
    'Architects data storage, server logic, and robust APIs that power applications. Focuses on concurrency, database indexing, caching strategies, and resilient microservice communication.',
    3.0,
    ARRAY['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Microservices', 'REST/gRPC', 'Docker'],
    'OPEN',
    '{"backend_apis_weight": 0.4, "database_performance_weight": 0.4, "system_design_weight": 0.2}'::jsonb
),
(
    'a1000005-0000-0000-0000-000000000033',
    'Frontend Developer',
    'Software Engineering',
    'Remote / New York',
    'Codes user-facing web interfaces using frameworks like React, Vue, or Angular. Champions responsive layouts, accessibility (WCAG), state management, and modern CSS architecture.',
    3.0,
    ARRAY['React', 'TypeScript', 'Next.js', 'CSS/Tailwind', 'Web Performance', 'State Management'],
    'OPEN',
    '{"frontend_architecture_weight": 0.5, "ui_polish_weight": 0.3, "web_performance_weight": 0.2}'::jsonb
),
(
    'a1000005-0000-0000-0000-000000000034',
    'Mobile App Developer',
    'Software Engineering',
    'Remote / Los Angeles',
    'Creates native or cross-platform applications for iOS and Android devices. Builds responsive mobile user interfaces, offline data sync, push notifications, and App Store releases.',
    3.0,
    ARRAY['React Native', 'Flutter', 'Swift', 'Kotlin', 'Mobile UX', 'App Store Deployment'],
    'OPEN',
    '{"mobile_frameworks_weight": 0.5, "native_features_weight": 0.3, "performance_offline_weight": 0.2}'::jsonb
),
(
    'a1000005-0000-0000-0000-000000000035',
    'Embedded Systems Engineer',
    'Software Engineering',
    'San Jose / Hybrid',
    'Writes software for physical hardware like IoT chips, automotive sensors, and smart appliances. Develops low-level firmware, driver interfaces, and real-time operating system tasks.',
    4.0,
    ARRAY['C', 'C++', 'RTOS', 'Microcontrollers (ARM/STM32)', 'Hardware Protocols (I2C/SPI/UART)', 'Firmware'],
    'OPEN',
    '{"embedded_c_cpp_weight": 0.5, "rtos_hardware_weight": 0.3, "firmware_debugging_weight": 0.2}'::jsonb
),
(
    'a1000005-0000-0000-0000-000000000036',
    'API Engineer',
    'Software Engineering',
    'Remote',
    'Specializes in designing, documenting, and securing microservices communication channels. Implements API gateways, rate limiting, OpenAPI specifications, and developer documentation.',
    4.0,
    ARRAY['OpenAPI/Swagger', 'gRPC', 'GraphQL', 'REST', 'Rate Limiting', 'API Gateways', 'Kong'],
    'OPEN',
    '{"api_design_weight": 0.5, "gateway_security_weight": 0.3, "developer_docs_weight": 0.2}'::jsonb
),
(
    'a1000005-0000-0000-0000-000000000037',
    'UI/UX Designer',
    'Software Engineering',
    'London / Remote',
    'Conducts user research and creates intuitive interfaces to optimize digital products. Develops design systems, interactive prototypes, user journey maps, and conducts usability testing.',
    3.0,
    ARRAY['Figma', 'UI/UX Design', 'User Research', 'Prototyping', 'Wireframing', 'Design Systems'],
    'OPEN',
    '{"ui_design_craft_weight": 0.5, "user_research_weight": 0.3, "design_systems_weight": 0.2}'::jsonb
),

-- 6. Quality Assurance, Automation & Support
(
    'a1000006-0000-0000-0000-000000000038',
    'QA Automation Engineer',
    'Quality Assurance & Support',
    'Remote',
    'Writes test scripts to automatically find bugs and check software performance. Creates end-to-end regression suites, performance benchmarks, and CI/CD automated test gates.',
    3.0,
    ARRAY['Cypress', 'Playwright', 'Selenium', 'Python', 'TypeScript', 'CI/CD Test Automation', 'TestNG'],
    'OPEN',
    '{"test_automation_weight": 0.5, "framework_design_weight": 0.3, "ci_cd_integration_weight": 0.2}'::jsonb
),
(
    'a1000006-0000-0000-0000-000000000039',
    'Manual QA Tester',
    'Quality Assurance & Support',
    'Remote',
    'Visually tests software workflows to catch usability issues from a human perspective. Designs comprehensive test plans, executes exploratory test rounds, and logs detailed reproduction steps in Jira.',
    2.0,
    ARRAY['Manual Testing', 'Test Case Design', 'Bug Tracking (Jira)', 'Usability Testing', 'Exploratory Testing'],
    'OPEN',
    '{"test_case_coverage_weight": 0.5, "exploratory_testing_weight": 0.3, "bug_reporting_weight": 0.2}'::jsonb
),
(
    'a1000006-0000-0000-0000-000000000040',
    'IT Support Specialist (Help Desk)',
    'Quality Assurance & Support',
    'Chicago / On-site',
    'Troubleshoots everyday hardware, software, and access issues for employees or clients. Configures workstations, resolves ticket escalations, and manages endpoint software deployment.',
    1.0,
    ARRAY['Technical Support', 'Jira Service Management', 'macOS/Windows Troubleshooting', 'Hardware Setup', 'Customer Service'],
    'OPEN',
    '{"troubleshooting_weight": 0.5, "customer_satisfaction_weight": 0.3, "hardware_setup_weight": 0.2}'::jsonb
),
(
    'a1000006-0000-0000-0000-000000000041',
    'Technical Writer',
    'Quality Assurance & Support',
    'Remote',
    'Drafts developer documentation, user manuals, and API guides for technical clarity. Maintains docs-as-code repos, architecture diagrams, and onboarding guides for engineering teams.',
    2.0,
    ARRAY['API Documentation', 'Markdown', 'Git', 'Technical Communication', 'Docs-as-Code', 'SDK Guides'],
    'OPEN',
    '{"technical_writing_weight": 0.5, "api_documentation_weight": 0.3, "docs_as_code_weight": 0.2}'::jsonb
),

-- 7. Tech Leadership, Product & Business Strategy
(
    'a1000007-0000-0000-0000-000000000042',
    'Product Manager',
    'Tech Leadership & Strategy',
    'San Francisco / Hybrid',
    'Defines the long-term vision, features, and release roadmap of software products. Gathers user requirements, prioritizes backlogs, and aligns cross-functional engineering and go-to-market teams.',
    4.0,
    ARRAY['Product Strategy', 'Roadmap Planning', 'User Story Mapping', 'Agile/Scrum', 'Data Analysis', 'Feature Prioritization'],
    'OPEN',
    '{"product_vision_weight": 0.5, "execution_weight": 0.3, "data_driven_weight": 0.2}'::jsonb
),
(
    'a1000007-0000-0000-0000-000000000043',
    'Scrum Master / Agile Coach',
    'Tech Leadership & Strategy',
    'Remote',
    'Facilitates team workflows, removes blockers, and speeds up product delivery cycles. Leads sprint planning, retrospectives, and coaches engineering teams in Agile best practices.',
    4.0,
    ARRAY['Scrum', 'Kanban', 'Agile Coaching', 'Jira', 'Sprint Facilitation', 'Continuous Improvement'],
    'OPEN',
    '{"agile_facilitation_weight": 0.5, "blocker_removal_weight": 0.3, "continuous_improvement_weight": 0.2}'::jsonb
),
(
    'a1000007-0000-0000-0000-000000000044',
    'Technical Project Manager (TPM)',
    'Tech Leadership & Strategy',
    'Seattle / Hybrid',
    'Manages engineering timelines, resource budgets, and cross-team dependencies. Drives complex technical deliveries from conception through launch with precise risk management.',
    5.0,
    ARRAY['Technical Project Management', 'Timeline Estimation', 'Risk Management', 'Cross-team Coordination', 'Resource Planning'],
    'OPEN',
    '{"project_delivery_weight": 0.5, "dependency_management_weight": 0.3, "risk_mitigation_weight": 0.2}'::jsonb
),
(
    'a1000007-0000-0000-0000-000000000045',
    'Enterprise Architect',
    'Tech Leadership & Strategy',
    'New York / Hybrid',
    'Strategizes the overarching tech ecosystem to align IT capabilities with business goals. Evaluates emerging technologies, governs enterprise standards, and guides long-term cloud transformation.',
    9.0,
    ARRAY['Enterprise Architecture', 'TOGAF', 'Cloud Modernization', 'Legacy Integration', 'Strategic Planning', 'Governance'],
    'OPEN',
    '{"enterprise_strategy_weight": 0.5, "standards_governance_weight": 0.3, "modernization_weight": 0.2}'::jsonb
),
(
    'a1000007-0000-0000-0000-000000000046',
    'IT Business Analyst',
    'Tech Leadership & Strategy',
    'Remote / Boston',
    'Evaluates company processes to determine technological solutions for operational problems. Documents business requirements, models workflows (BPMN), and performs gap analysis.',
    3.0,
    ARRAY['Business Requirements Analysis', 'Process Mapping', 'BPMN', 'SQL', 'Stakeholder Management', 'Gap Analysis'],
    'OPEN',
    '{"requirements_analysis_weight": 0.5, "workflow_modeling_weight": 0.3, "stakeholder_comm_weight": 0.2}'::jsonb
),
(
    'a1000007-0000-0000-0000-000000000047',
    'Chief Technology Officer (CTO)',
    'Tech Leadership & Strategy',
    'San Francisco / Executive',
    'Outlines the macro technology strategy and drives innovation across the entire organization. Mentors engineering leaders, oversees technical due diligence, and steers technical vision.',
    12.0,
    ARRAY['Technology Strategy', 'Executive Leadership', 'Architecture Governance', 'Talent Building', 'R&D', 'Venture Strategy'],
    'OPEN',
    '{"technology_vision_weight": 0.4, "organizational_leadership_weight": 0.4, "strategic_execution_weight": 0.2}'::jsonb
),

-- 8. Specialized & Emerging Domains
(
    'a1000008-0000-0000-0000-000000000048',
    'IoT Engineer',
    'Specialized & Emerging Domains',
    'Austin, TX / Hybrid',
    'Develops and connects smart networks of physical sensors, edge devices, and cloud backends. Implements MQTT telemetry pipelines, edge compute models, and device fleet security.',
    4.0,
    ARRAY['IoT Protocols (MQTT/CoAP)', 'Edge Computing', 'AWS IoT / Azure IoT', 'Microcontrollers', 'Python/C++', 'Device Provisioning'],
    'OPEN',
    '{"iot_protocols_weight": 0.5, "edge_computing_weight": 0.3, "cloud_iot_backend_weight": 0.2}'::jsonb
),
(
    'a1000008-0000-0000-0000-000000000049',
    'RPA Developer',
    'Specialized & Emerging Domains',
    'Remote',
    'Builds robotic process automation bots to handle repetitive, manual office tasks. Automates multi-application workflows, OCR document extraction, and desktop automation.',
    3.0,
    ARRAY['UiPath', 'Automation Anywhere', 'Process Automation', 'VB.NET/C#', 'Workflow Orchestration', 'OCR'],
    'OPEN',
    '{"rpa_bot_design_weight": 0.5, "workflow_automation_weight": 0.3, "exception_handling_weight": 0.2}'::jsonb
),
(
    'a1000008-0000-0000-0000-000000000050',
    'Salesforce / CRM Administrator',
    'Specialized & Emerging Domains',
    'Remote / Dallas',
    'Optimizes and configures customer relationship management software to match sales pipelines. Builds custom Flow automations, user permissions, object schemas, and sales reports.',
    3.0,
    ARRAY['Salesforce Administration', 'Flow Automation', 'Apex Basics', 'CRM Customization', 'User Roles & Security', 'Reports & Dashboards'],
    'OPEN',
    '{"crm_flows_weight": 0.5, "schema_customization_weight": 0.3, "security_roles_weight": 0.2}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    department = EXCLUDED.department,
    location = EXCLUDED.location,
    job_description = EXCLUDED.job_description,
    min_years_experience = EXCLUDED.min_years_experience,
    required_skills = EXCLUDED.required_skills,
    status = EXCLUDED.status,
    structured_criteria = EXCLUDED.structured_criteria;
