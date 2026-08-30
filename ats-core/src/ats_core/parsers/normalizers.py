import re
import logging
from typing import Optional, List, Dict, Tuple, Set, Any
import dateparser
import phonenumbers
from rapidfuzz import process, fuzz

logger = logging.getLogger("ats.parsers.normalizers")

# =====================================================================
# 1. DATE NORMALIZATION
# =====================================================================

PRESENT_TOKENS: Set[str] = {
    "present", "current", "now", "till date", "to date", 
    "present day", "current role", "till now", "ongoing", 
    "current position", "currently working", "active", "today"
}

# Regex matching isolated 4-digit years (1950 - 2099)
YEAR_ONLY_REGEX = re.compile(r"^(?:19|20)\d{2}$")

# Regex to detect date range strings (e.g., "May 2021 - Present", "2020 — 2023", "01/2021 to 05/2022")
DATE_RANGE_SPLIT_REGEX = re.compile(r"\s*(?:[-–—/]|(?:\s+to\s+)|\s+until\s+)\s*", re.IGNORECASE)


def normalize_date(raw: Optional[str], is_current: bool = False) -> Optional[str]:
    """
    Deterministically normalizes raw date strings into standardized formats:
    - Current/Present role -> "Present"
    - Year-only ("2021") -> "2021" (preserves year precision without fabricating a month)
    - Specific month/year ("May 2021", "05/2021", "2021-05") -> "2021-05" (YYYY-MM)
    - Unparseable garbage -> None (allows downstream confidence scorer to flag)

    Special handling:
    - Never passes 'present' tokens to dateparser (which parses them incorrectly).
    - Prevents ambiguous timezone conversions.
    """
    if not raw:
        return None

    cleaned = raw.strip()
    cleaned_lower = cleaned.lower().rstrip(".").strip()

    # Rule 1: Check for Present / Current tokens FIRST
    if is_current or cleaned_lower in PRESENT_TOKENS:
        return "Present"

    # Rule 2: Year-only representation (keep year precision, e.g. "2020" -> "2020", NOT "2020-01")
    if YEAR_ONLY_REGEX.fullmatch(cleaned_lower):
        return cleaned_lower

    # Rule 3: Common Month-Year abbreviation patterns (e.g., "May 2025", "Dec 2024", "Jun 24")
    # Clean leading/trailing parentheses or extra characters like "(exp)" or "est."
    sanitized = re.sub(r"(?i)\s*\((?:exp|expected|est|estimated)\)", "", cleaned_lower).strip()

    # Parse with dateparser (preferring past dates for historical resume entries)
    try:
        dt = dateparser.parse(
            sanitized,
            settings={
                "RETURN_AS_TIMEZONE_AWARE": False,
                "PREFER_DATES_FROM": "past",
                "PREFER_DAY_OF_MONTH": "first",
            }
        )
        if dt is not None:
            # Check if input had only a year after sanitization
            if YEAR_ONLY_REGEX.fullmatch(sanitized):
                return sanitized
            return dt.strftime("%Y-%m")
    except Exception as e:
        logger.debug(f"Dateparser failed on '{raw}': {e}")

    return None


def normalize_date_range(raw_range: str) -> Tuple[Optional[str], Optional[str], bool]:
    """
    Parses a composite date range string (e.g., 'May 2021 – Present', '2019 - 2022', 'Dec 2024-Jan 2025').
    Returns: (start_date, end_date, is_current_role)
    """
    if not raw_range:
        return None, None, False

    clean_text = raw_range.strip()
    parts = DATE_RANGE_SPLIT_REGEX.split(clean_text)

    if len(parts) >= 2:
        start_raw = parts[0].strip()
        end_raw = parts[1].strip()

        is_current = any(tok in end_raw.lower() for tok in PRESENT_TOKENS)
        start_norm = normalize_date(start_raw, is_current=False)
        end_norm = normalize_date(end_raw, is_current=is_current)

        return start_norm, end_norm, is_current
    elif len(parts) == 1:
        single_norm = normalize_date(parts[0], is_current=False)
        return single_norm, None, False

    return None, None, False


# =====================================================================
# 2. PHONE NUMBER NORMALIZATION
# =====================================================================

def normalize_phone(
    raw: Optional[str],
    default_region: str = "US",
    preferred_regions: Tuple[str, ...] = ("US", "IN", "GB", "CA", "DE", "FR", "SG", "AU")
) -> Optional[str]:
    """
    Deterministically parses and normalizes phone numbers into international E.164 standard (+14155550182, +918667660065).
    Features multi-region fallback resolution (e.g. automatically recognizes +91 / Indian 10-digit mobile numbers).
    """
    if not raw:
        return None

    cleaned = raw.strip()
    if len(cleaned) < 7:
        return None

    # Step 1: If string explicitly starts with '+', parse with international auto-detect
    if cleaned.startswith("+"):
        try:
            num = phonenumbers.parse(cleaned, None)
            if phonenumbers.is_valid_number(num):
                return phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
        except phonenumbers.NumberParseException:
            pass

    # Step 2: Try default region
    try:
        num = phonenumbers.parse(cleaned, default_region)
        if phonenumbers.is_valid_number(num):
            return phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException:
        pass

    # Step 3: Multi-region fallback (e.g., if default is US but number is Indian +91 or UK +44)
    for region in preferred_regions:
        if region == default_region:
            continue
        try:
            num = phonenumbers.parse(cleaned, region)
            if phonenumbers.is_valid_number(num):
                return phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
        except phonenumbers.NumberParseException:
            continue

    # Step 4: Clean regex fallback for well-structured national numbers (e.g., +91-86676-60065)
    clean_digits = re.sub(r"[^\d+]", "", cleaned)
    if clean_digits.startswith("+") and 10 <= len(clean_digits) <= 15:
        return clean_digits
    elif len(clean_digits) == 10 and clean_digits[0] in "6789":
        # Indian 10-digit mobile number
        return f"+91{clean_digits}"
    elif len(clean_digits) == 10 and clean_digits[0] in "23456789":
        # US 10-digit number
        return f"+1{clean_digits}"

    return None


# =====================================================================
# 3. SKILLS TAXONOMY & DETERMINISTIC ALIAS / FUZZY NORMALIZATION
# =====================================================================

# Crucial Guard: Short or single/double-letter acronyms MUST NEVER pass through fuzzy matching
# to avoid false-positive over-matching (e.g., 'C' matching 'CI', 'R' matching 'Ruby', 'Go' matching 'Django').
SHORT_EXACT_SKILLS: Set[str] = {
    "c", "r", "go", "d", "js", "ts", "ai", "ml", "ui", "ux", "ci", "cd", 
    "qa", "db", "ip", "os", "c++", "c#", "f#", "vb", "vb.net", ".net", "sql", "git"
}

# Distinct short skill canonical mappings
EXACT_SHORT_MAP: Dict[str, str] = {
    "c": "C",
    "c++": "C++",
    "cpp": "C++",
    "c#": "C#",
    "csharp": "C#",
    "r": "R",
    "go": "Go",
    "golang": "Go",
    "js": "JavaScript",
    "ts": "TypeScript",
    "ai": "Artificial Intelligence",
    "ml": "Machine Learning",
    "ui": "UI/UX",
    "ux": "UI/UX",
    "ui/ux": "UI/UX",
    "sql": "SQL",
    "git": "Git",
    "os": "Operating Systems",
    "ci": "CI/CD",
    "cd": "CI/CD",
    "ci/cd": "CI/CD",
    "cicd": "CI/CD",
    "qa": "QA Testing",
    ".net": ".NET",
    "dotnet": ".NET",
}

# Comprehensive Technical Skill Taxonomy (~350+ entries covering modern engineering domains)
SKILL_ALIASES: Dict[str, str] = {
    # Programming Languages
    "python": "Python", "py": "Python", "python3": "Python", "python2": "Python",
    "javascript": "JavaScript", "es6": "JavaScript", "es2015": "JavaScript", "ecmascript": "JavaScript",
    "typescript": "TypeScript",
    "java": "Java", "core java": "Java", "j2ee": "Java", "jdk": "Java",
    "rust": "Rust", "rustlang": "Rust",
    "ruby": "Ruby", "ruby on rails": "Ruby on Rails", "rails": "Ruby on Rails",
    "php": "PHP", "php8": "PHP", "php7": "PHP",
    "scala": "Scala", "kotlin": "Kotlin", "swift": "Swift", "swiftui": "SwiftUI",
    "dart": "Dart", "flutter": "Flutter",
    "bash": "Bash", "shell": "Shell Scripting", "shell scripting": "Shell Scripting", "zsh": "Zsh", "powershell": "PowerShell",
    "html": "HTML", "html5": "HTML", "css": "CSS", "css3": "CSS", "html/css": "HTML/CSS", "html5/css3": "HTML/CSS",
    "sass": "Sass", "scss": "Sass", "less": "Less",

    # Frontend & UI/UX
    "react": "React", "reactjs": "React", "react js": "React", "react.js": "React", "react native": "React Native",
    "next": "Next.js", "nextjs": "Next.js", "next js": "Next.js", "next.js": "Next.js",
    "vue": "Vue.js", "vuejs": "Vue.js", "vue js": "Vue.js", "vue.js": "Vue.js", "vue3": "Vue.js", "nuxt": "Nuxt.js", "nuxtjs": "Nuxt.js",
    "angular": "Angular", "angularjs": "Angular", "angular.js": "Angular", "angular 2+": "Angular",
    "svelte": "Svelte", "sveltekit": "SvelteKit",
    "tailwind": "Tailwind CSS", "tailwindcss": "Tailwind CSS", "tailwind css": "Tailwind CSS",
    "bootstrap": "Bootstrap", "bootstrap 5": "Bootstrap",
    "redux": "Redux", "redux toolkit": "Redux", "rtk": "Redux",
    "zustand": "Zustand", "mobx": "MobX", "recoil": "Recoil",
    "webpack": "Webpack", "vite": "Vite", "vitejs": "Vite", "turbopack": "Turbopack", "rollup": "Rollup",
    "figma": "Figma", "spline": "Spline", "user research": "User Research", "wireframing": "Wireframing", "prototyping": "Prototyping",

    # Backend Frameworks & APIs
    "fastapi": "FastAPI", "fast api": "FastAPI",
    "django": "Django", "drf": "Django REST Framework", "django rest framework": "Django REST Framework",
    "flask": "Flask",
    "node": "Node.js", "nodejs": "Node.js", "node js": "Node.js", "node.js": "Node.js",
    "express": "Express", "expressjs": "Express", "express.js": "Express",
    "nestjs": "NestJS", "nest.js": "NestJS", "nest js": "NestJS",
    "spring": "Spring Boot", "springboot": "Spring Boot", "spring boot": "Spring Boot", "spring framework": "Spring Framework",
    "asp.net": ".NET Core", "asp.net core": ".NET Core", ".net core": ".NET Core",
    "graphql": "GraphQL", "apollo": "Apollo GraphQL", "apollo client": "Apollo GraphQL",
    "grpc": "gRPC", "rest": "REST APIs", "restful apis": "REST APIs", "rest apis": "REST APIs", "rest api": "REST APIs",
    "websockets": "WebSockets", "websocket": "WebSockets", "socket.io": "Socket.io",
    "celery": "Celery",

    # Databases, Caching & Vector Stores
    "postgres": "PostgreSQL", "postgresql": "PostgreSQL", "psql": "PostgreSQL",
    "mysql": "MySQL",
    "mongodb": "MongoDB", "mongo": "MongoDB",
    "redis": "Redis",
    "elasticsearch": "Elasticsearch", "elastic search": "Elasticsearch",
    "cassandra": "Cassandra", "apache cassandra": "Cassandra",
    "dynamodb": "DynamoDB", "dynamo db": "DynamoDB",
    "sqlite": "SQLite", "sqlite3": "SQLite",
    "snowflake": "Snowflake", "bigquery": "BigQuery", "google bigquery": "BigQuery",
    "neo4j": "Neo4j",
    "firebase": "Firebase", "firestore": "Firebase Firestore",
    "supabase": "Supabase",
    "pgvector": "pgvector", "vector db": "Vector Databases",
    "qdrant": "Qdrant", "pinecone": "Pinecone", "weaviate": "Weaviate", "milvus": "Milvus", "chroma": "ChromaDB", "chromadb": "ChromaDB",

    # Cloud, DevOps & Infrastructure
    "aws": "AWS", "amazon web services": "AWS",
    "gcp": "GCP", "google cloud": "GCP", "google cloud platform": "GCP",
    "azure": "Azure", "microsoft azure": "Azure",
    "docker": "Docker", "docker compose": "Docker Compose", "containerization": "Docker",
    "kubernetes": "Kubernetes", "k8s": "Kubernetes", "helm": "Helm",
    "terraform": "Terraform",
    "github actions": "GitHub Actions", "gh actions": "GitHub Actions",
    "gitlab ci": "GitLab CI", "gitlab-ci": "GitLab CI",
    "jenkins": "Jenkins", "ansible": "Ansible",
    "linux": "Linux", "unix": "Unix", "ubuntu": "Ubuntu",
    "nginx": "Nginx", "apache": "Apache HTTP Server",
    "kafka": "Kafka", "apache kafka": "Kafka",
    "rabbitmq": "RabbitMQ",
    "prometheus": "Prometheus", "grafana": "Grafana", "datadog": "Datadog",

    # AI / Machine Learning & Data Science
    "machine learning": "Machine Learning",
    "deep learning": "Deep Learning",
    "pytorch": "PyTorch", "torch": "PyTorch",
    "tensorflow": "TensorFlow",
    "scikit-learn": "scikit-learn", "sklearn": "scikit-learn",
    "pandas": "Pandas", "numpy": "NumPy", "scipy": "SciPy",
    "matplotlib": "Matplotlib", "seaborn": "Seaborn",
    "opencv": "OpenCV", "cv2": "OpenCV",
    "roboflow": "Roboflow", "manim": "Manim",
    "huggingface": "HuggingFace", "transformers": "HuggingFace Transformers",
    "langchain": "LangChain", "llamaindex": "LlamaIndex", "llama-index": "LlamaIndex",
    "natural language processing": "NLP", "nlp": "NLP",
    "computer vision": "Computer Vision",
    "large language models": "LLMs", "llm": "LLMs", "llms": "LLMs",
    "prompt engineering": "Prompt Engineering",
    "jupyter": "Jupyter", "jupyter notebook": "Jupyter", "colab": "Google Colab", "google colab": "Google Colab",
    "apache spark": "Apache Spark", "spark": "Apache Spark", "pyspark": "PySpark",
    "airflow": "Apache Airflow", "apache airflow": "Apache Airflow",
    "cuda": "CUDA", "triton": "Triton",

    # Methodologies, Architecture & Tools
    "github": "GitHub", "gitlab": "GitLab", "bitbucket": "Bitbucket",
    "jira": "Jira", "confluence": "Confluence",
    "agile": "Agile", "scrum": "Scrum", "kanban": "Kanban",
    "microservices": "Microservices", "microservice architecture": "Microservices",
    "system design": "System Design", "distributed systems": "Distributed Systems",
    "tdd": "TDD", "test-driven development": "TDD", "unit testing": "Unit Testing",
    "pytest": "Pytest", "jest": "Jest", "cypress": "Cypress", "playwright": "Playwright", "selenium": "Selenium",
    "postman": "Postman", "swagger": "OpenAPI / Swagger", "openapi": "OpenAPI / Swagger",
}


def normalize_skill(
    raw: str,
    fuzzy_cutoff: float = 88.0,
    register_flywheel: bool = True,
    source: str = "resume_parser",
    context: Optional[str] = None
) -> str:
    """
    Normalizes a skill name through the database-backed SkillTaxonomyService:
    1. Exact short-skill guard (prevents 'C', 'R', 'Go', 'JS' from fuzzy overmatching).
    2. Direct alias lookup against taxonomy (~500+ skills).
    3. High-precision fuzzy matching using rapidfuzz WRatio.
    4. Flywheel registration: Unrecognized skills are registered into status='pending'.
    5. Fallback: Preserves candidate's original clean wording without fabricating non-existent skills.
    """
    if not raw or not isinstance(raw, str):
        return ""

    cleaned = raw.strip()
    if not cleaned:
        return ""

    # Import taxonomy service
    from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService
    taxonomy = SkillTaxonomyService.get_instance()

    record = taxonomy.lookup_skill(cleaned, fuzzy_cutoff=fuzzy_cutoff)
    if record and record.get("canonical_name"):
        return record["canonical_name"]

    # Fallback to local dictionary if taxonomy lookup yielded None
    key = re.sub(r"[^\w\s+#./-]", "", cleaned.lower()).strip()
    if key in SHORT_EXACT_SKILLS or key in EXACT_SHORT_MAP:
        return EXACT_SHORT_MAP.get(key, key.upper() if len(key) <= 3 else key.capitalize())

    if key in SKILL_ALIASES:
        return SKILL_ALIASES[key]

    alt_key = re.sub(r"[^\w\s]", "", key).strip()
    if alt_key in SKILL_ALIASES:
        return SKILL_ALIASES[alt_key]

    if len(key) >= 4:
        match = process.extractOne(
            key,
            list(SKILL_ALIASES.keys()),
            scorer=fuzz.WRatio,
            score_cutoff=fuzzy_cutoff
        )
        if match:
            matched_key = match[0]
            if matched_key not in SHORT_EXACT_SKILLS and len(matched_key) >= 4:
                return SKILL_ALIASES[matched_key]

    # Step 4: Unknown skill -> Register into Flywheel review queue
    if register_flywheel and 2 <= len(cleaned) <= 50:
        taxonomy.record_unknown_skill(cleaned, source=source, context=context)

    # Step 5: Fallback - preserve candidate's wording in standard title-case or uppercase
    if cleaned.isupper() and len(cleaned) <= 5:
        return cleaned
    elif len(cleaned.split()) == 1 and cleaned[0].islower():
        return cleaned.capitalize()
    return cleaned


def normalize_skills_list(
    skills: List[str],
    fuzzy_cutoff: float = 88.0,
    register_flywheel: bool = True,
    source: str = "resume_parser"
) -> List[str]:
    """
    Normalizes and deduplicates a list of extracted skills while preserving chronological insertion order.
    Feeds unknown skills into the status='pending' Flywheel queue.
    """
    if not skills:
        return []

    seen: Set[str] = set()
    normalized: List[str] = []

    for s in skills:
        norm = normalize_skill(
            s,
            fuzzy_cutoff=fuzzy_cutoff,
            register_flywheel=register_flywheel,
            source=source
        )
        if norm and norm.lower() not in seen:
            seen.add(norm.lower())
            normalized.append(norm)

    return normalized

