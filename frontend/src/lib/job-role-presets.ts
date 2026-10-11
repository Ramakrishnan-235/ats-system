export interface JobRolePreset {
  title: string;
  domain: string;
  department: string;
  skills: string[];
  description: string;
}

// Starter criteria are editable by the recruiter before a requisition is saved.
const groups: { domain: string; department: string; roles: [string, string[], string][] }[] = [
  { domain: "AI, Machine Learning & Advanced Tech", department: "AI & Intelligent Systems", roles: [
    ["AI Engineer / Machine Learning Engineer", ["Python", "PyTorch", "Machine Learning", "Model Deployment"], "Build, evaluate and deploy machine learning models; monitor performance and document reproducible experiments."],
    ["Generative AI Specialist / Prompt Engineer", ["LLMs", "Prompt Engineering", "RAG", "Python", "Evaluation"], "Develop generative AI applications, retrieval pipelines and prompts; evaluate grounded outputs, safety and cost."],
    ["Data Scientist", ["Python", "SQL", "Statistics", "Machine Learning"], "Design experiments, analyze data and build predictive models; communicate assumptions and measurable business results."],
    ["Computer Research Scientist", ["Algorithms", "Research", "Python", "Experiment Design"], "Investigate computing problems, develop novel methods and validate findings through reproducible experiments and technical publications."],
    ["Computer Vision Engineer", ["Python", "OpenCV", "PyTorch", "Computer Vision"], "Build image and video understanding systems; prepare datasets, evaluate models and optimize inference."],
    ["NLP (Natural Language Processing) Engineer", ["Python", "NLP", "Transformers", "Text Processing"], "Develop language processing pipelines, train or adapt text models and evaluate performance across relevant languages and datasets."],
    ["Robotics Process Automation (RPA) Developer", ["UiPath", "Process Automation", "Workflow Design", "Testing"], "Automate repeatable business workflows, integrate systems and implement exception handling, monitoring and reliable recovery."],
    ["Blockchain Developer / Engineer", ["Solidity", "Smart Contracts", "Blockchain", "Security Testing"], "Develop and test blockchain applications and smart contracts; review transaction behavior, security and integration reliability."],
    ["AR/VR Developer", ["Unity", "C#", "OpenXR", "3D Development"], "Build immersive experiences, integrate interaction and tracking systems and optimize rendering and usability on target devices."],
  ] },
  { domain: "Software Development & Engineering", department: "Software Engineering", roles: [
    ["Full-Stack Developer", ["JavaScript", "React", "Node.js", "SQL", "REST APIs"], "Build accessible user interfaces and backend services; integrate databases and APIs and maintain automated tests."],
    ["Backend Developer", ["API Design", "SQL", "Backend Development", "Testing"], "Design reliable backend services and APIs; optimize data access, enforce security and support deployment and monitoring."],
    ["Front-End Developer", ["JavaScript", "TypeScript", "React", "HTML", "CSS"], "Build responsive, accessible web interfaces; integrate APIs and improve browser performance and automated UI coverage."],
    ["Mobile Application Developer (iOS/Android)", ["Mobile Development", "Swift", "Kotlin", "API Integration"], "Develop mobile applications for the selected platform; integrate APIs, test device behavior and manage application releases."],
    ["Software Engineer / Programmer", ["Programming", "Data Structures", "Algorithms", "Git", "Testing"], "Design and implement maintainable software; review code, write tests and collaborate on requirements and delivery."],
    ["Java Developer", ["Java", "Spring Boot", "SQL", "JUnit"], "Develop Java services and applications; implement database access, automated tests and performance improvements."],
    ["Python Developer", ["Python", "FastAPI", "SQL", "pytest"], "Build Python applications and APIs; maintain reliable data processing, automated tests and deployment documentation."],
    ["Dot NET Developer", ["C#", ".NET", "ASP.NET Core", "SQL Server"], "Build and maintain .NET applications and APIs; implement secure data access, testing and deployment workflows."],
    ["Game Developer", ["Game Development", "Unity", "C#", "3D Mathematics"], "Implement gameplay and interactive systems; collaborate with artists and designers and optimize runtime performance."],
    ["API Engineer / Integration Specialist", ["REST APIs", "OAuth", "Integration", "OpenAPI"], "Design and integrate APIs; manage authentication, versioning, data mapping, retries and integration testing."],
    ["Embedded Systems Engineer", ["C", "C++", "RTOS", "Hardware Interfaces"], "Develop firmware and embedded applications; debug hardware interfaces and validate timing, reliability and resource usage."],
  ] },
  { domain: "Data Engineering & Analytics", department: "Data Science & Analytics", roles: [
    ["Data Engineer", ["Python", "SQL", "ETL", "Data Pipelines"], "Build reliable data pipelines and datasets; enforce data quality, lineage and efficient storage and transformation."],
    ["Big Data Engineer", ["Apache Spark", "Kafka", "SQL", "Distributed Systems"], "Build distributed batch and streaming pipelines; optimize processing throughput, fault recovery and data quality."],
    ["Data Analyst", ["SQL", "Excel", "Statistics", "Data Analysis"], "Analyze business data, validate metrics and communicate actionable findings through reports and dashboards."],
    ["Business Intelligence (BI) Analyst", ["SQL", "Power BI", "Data Modeling", "Reporting"], "Define business metrics and create BI reports; maintain semantic models and validate reporting accuracy with stakeholders."],
    ["Database Administrator (DBA)", ["SQL", "Database Administration", "Backup & Recovery", "Performance Tuning"], "Maintain database availability, access controls, backups and recovery; diagnose query performance and capacity issues."],
    ["Data Modeler", ["Data Modeling", "SQL", "Dimensional Modeling", "Data Governance"], "Design conceptual, logical and physical data models; document relationships, standards and data definitions."],
    ["Data Visualization Engineer", ["Data Visualization", "SQL", "D3.js", "Dashboard Design"], "Build clear interactive visualizations and dashboards; ensure accurate metrics, accessible design and responsive performance."],
  ] },
  { domain: "Cloud, DevOps & Infrastructure", department: "Cloud & Infrastructure", roles: [
    ["Cloud Engineer", ["Cloud Infrastructure", "Terraform", "Linux", "Networking"], "Provision and operate cloud infrastructure; automate deployments, enforce access controls and monitor reliability and cost."],
    ["Cloud Architect", ["Cloud Architecture", "Networking", "Security", "Cost Optimization"], "Design cloud solutions with documented reliability, security and cost tradeoffs; guide migrations and architecture reviews."],
    ["DevOps Engineer", ["CI/CD", "Docker", "Terraform", "Linux"], "Automate build and release pipelines; improve deployment reliability, infrastructure consistency and production monitoring."],
    ["Platform Engineer", ["Kubernetes", "Infrastructure as Code", "CI/CD", "Developer Experience"], "Build internal developer platforms and reusable deployment workflows; improve self-service, security and operational reliability."],
    ["Site Reliability Engineer (SRE)", ["Observability", "Linux", "Incident Response", "Automation", "SLOs"], "Define service reliability targets, automate operational work and lead incident diagnosis, recovery and prevention."],
    ["Systems Administrator (SysAdmin)", ["Linux", "Windows Server", "Systems Administration", "Backup & Recovery"], "Maintain operating systems, access controls, patching and backups; troubleshoot incidents and document operational procedures."],
    ["Network Engineer", ["TCP/IP", "Routing", "Switching", "Network Security"], "Configure and troubleshoot enterprise networks; monitor connectivity, manage network changes and maintain secure configurations."],
    ["Computer Network Architect", ["Network Architecture", "Routing", "Capacity Planning", "Network Security"], "Design network topology, connectivity and resilience; plan capacity, validate architecture and document implementation standards."],
  ] },
  { domain: "Cybersecurity & Compliance", department: "Cybersecurity & Risk", roles: [
    ["Cybersecurity Engineer", ["Security Engineering", "IAM", "Threat Modeling", "Incident Response"], "Implement security controls, review system threats and remediate vulnerabilities; improve monitoring and incident preparedness."],
    ["Information Security Analyst", ["Risk Assessment", "Security Monitoring", "Vulnerability Management", "Incident Response"], "Assess security risks, investigate alerts and coordinate remediation; maintain evidence and communicate control gaps."],
    ["Penetration Tester (Ethical Hacker)", ["Penetration Testing", "OWASP", "Burp Suite", "Security Reporting"], "Conduct authorized security assessments within agreed scope; validate vulnerabilities and document reproducible remediation guidance."],
    ["Security Operations Center (SOC) Analyst", ["SIEM", "Log Analysis", "Threat Detection", "Incident Response"], "Triage security alerts, investigate suspicious activity and escalate incidents; improve detection rules and response procedures."],
    ["IT Auditor", ["IT Audit", "Risk Assessment", "Control Testing", "Audit Reporting"], "Assess IT controls and supporting evidence; document findings and track remediation against applicable organizational requirements."],
    ["IT Compliance Manager", ["Compliance Management", "Risk Management", "Policy Development", "Control Frameworks"], "Coordinate IT compliance programs, policy reviews and audit readiness; track control ownership and remediation evidence."],
  ] },
  { domain: "Product, Design & Business Strategy", department: "Tech Leadership & Strategy", roles: [
    ["UX Designer (User Experience)", ["User Research", "Interaction Design", "Prototyping", "Usability Testing"], "Research user needs, design workflows and prototypes and validate usability and accessibility through testing."],
    ["UI Designer (User Interface)", ["Figma", "Visual Design", "Design Systems", "Accessibility"], "Design consistent user interfaces and reusable design components; document responsive states and collaborate on implementation."],
    ["Product Manager (IT / Software)", ["Product Strategy", "Roadmapping", "Requirements", "Product Analytics"], "Prioritize product opportunities, define requirements and success metrics and coordinate discovery and delivery with stakeholders."],
    ["AI Product Manager", ["AI Product Strategy", "Model Evaluation", "Product Analytics", "Responsible AI"], "Define AI product use cases and evaluation criteria; balance user value, model quality, privacy, cost and delivery priorities."],
    ["Business Analyst (BA)", ["Requirements Analysis", "Process Modeling", "Stakeholder Management", "Documentation"], "Elicit business requirements, map workflows and define acceptance criteria; support stakeholder alignment and solution validation."],
    ["Solutions Architect", ["Solution Architecture", "System Integration", "API Design", "Technical Communication"], "Translate business needs into solution designs; document integration, security and scaling tradeoffs and guide implementation."],
  ] },
  { domain: "Quality Assurance, Operations & Support", department: "Quality Assurance & Support", roles: [
    ["Quality Assurance (QA) Engineer / Software Tester", ["Test Design", "Test Automation", "API Testing", "Defect Management"], "Plan and execute functional and regression tests; automate critical checks and document defects with reproducible evidence."],
    ["IT Project Manager / Scrum Master", ["Project Management", "Agile", "Scrum", "Risk Management"], "Coordinate delivery plans, dependencies and risks; facilitate team ceremonies and communicate progress and blockers."],
    ["Help Desk Technician / IT Support Specialist", ["Troubleshooting", "Ticket Management", "Windows", "Customer Support"], "Resolve user support requests, troubleshoot devices and applications and document solutions and escalation procedures."],
  ] },
];

export const JOB_ROLE_DOMAINS = groups.map(group => group.domain);
export const JOB_ROLE_PRESETS: JobRolePreset[] = groups.flatMap(group =>
  group.roles.map(([title, skills, responsibilities]) => ({
    title,
    domain: group.domain,
    department: group.department,
    skills,
    description: `Role: ${title}\n\nKey responsibilities:\n${responsibilities}\n\nRelevant skills:\n${skills.join(", ")}\n\nDemonstrate relevant work through projects or professional experience. Describe your individual contributions, results and technical decisions.`,
  }))
);
