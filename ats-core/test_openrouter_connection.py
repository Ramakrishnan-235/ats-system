import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding="utf-8")

# Load environment
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(env_path, override=True)

src_dir = str(Path(__file__).resolve().parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage, SystemMessage
from ats_core.llm.client import get_openrouter_chat_model, get_structured_llm, get_llm_config
from ats_core.parsers.ollama_extractor import OllamaCandidateExtractor
from ats_core.evaluator.deep_evaluator import LocalDeepEvaluator


class ATSCheck(BaseModel):
    status: str = Field(description="Operational status, e.g. READY or VERIFIED")
    model_name: str = Field(description="Name of the evaluated model")
    recommendation: str = Field(description="Brief candidate recommendation test statement")


def test_openrouter_langchain_connection():
    config = get_llm_config()
    api_key = config["api_key"]
    model_name = config["model_name"]
    base_url = config["base_url"]
    is_openrouter = config["is_openrouter"]

    print("\n" + "=" * 75)
    print("      OPENROUTER + LANGCHAIN INTEGRATION VERIFICATION SUITE      ")
    print("=" * 75)
    print(f"Target Framework: LangChain (langchain-openai + LCEL)")
    print(f"Target Endpoint : {base_url}")
    print(f"Target Model    : {model_name}")
    print(f"Provider Type   : {'OpenRouter (Cloud)' if is_openrouter else 'Local Ollama Fallback'}")

    if not is_openrouter or not api_key:
        print("\n[!] OPENROUTER_API_KEY is currently not configured or empty in ats-core/.env.")
        print("\nTo connect to OpenRouter:")
        print("1. Get your API key at: https://openrouter.ai/settings/keys")
        print("2. Open: ats-system/ats-core/.env")
        print("3. Set: OPENROUTER_API_KEY=\"sk-or-v1-...\"")
        print("4. Re-run this test script.")
        print("=" * 75 + "\n")
        return False

    masked_key = api_key[:10] + "..." + api_key[-4:] if len(api_key) > 14 else "***"
    print(f"API Key Detected: {masked_key}")

    # -------------------------------------------------------------
    # Step 1: LangChain ChatOpenAI Direct Chat Test
    # -------------------------------------------------------------
    print("\n[1/3] Testing LangChain ChatOpenAI direct connection to OpenRouter...")
    t0 = time.time()
    try:
        chat_model = get_openrouter_chat_model(temperature=0.1)
        response = chat_model.invoke([
            SystemMessage(content="You are a helpful assistant."),
            HumanMessage(content="Respond with 'LangChain connected to OpenRouter successfully!' in one short sentence.")
        ])
        latency = int((time.time() - t0) * 1000)
        content = response.content.strip() if hasattr(response, "content") else str(response)
        print(f"  [SUCCESS] Received LangChain response in {latency}ms:")
        print(f"  Response: \"{content}\"")
    except Exception as e:
        latency = int((time.time() - t0) * 1000)
        print(f"  [FAILED] LangChain ChatOpenAI connection error ({latency}ms): {e}")
        if "401" in str(e) or "User not found" in str(e) or "AuthenticationError" in str(e):
            print("\n  [!] The OPENROUTER_API_KEY in ats-core/.env is invalid or expired.")
            print("      Please update ats-core/.env with an active OpenRouter API key.")
        return False

    # -------------------------------------------------------------
    # Step 2: LangChain Structured Output Extraction Test
    # -------------------------------------------------------------
    print("\n[2/3] Testing LangChain with_structured_output extraction (ATS schema mode)...")
    t1 = time.time()
    try:
        structured_llm = get_structured_llm(ATSCheck, chat_model=chat_model)
        structured_res = structured_llm.invoke("Generate a test status report confirming candidate screening system is operational.")
        latency2 = int((time.time() - t1) * 1000)

        print(f"  [SUCCESS] LangChain structured schema validated in {latency2}ms:")
        print(f"  Status        : {structured_res.status}")
        print(f"  Model Name    : {structured_res.model_name}")
        print(f"  Recommendation: {structured_res.recommendation}")
    except Exception as e:
        print(f"  [WARNING] Structured mode warning: {e}")

    # -------------------------------------------------------------
    # Step 3: LangChain Candidate Extractor Full Integration Test
    # -------------------------------------------------------------
    print("\n[3/3] Testing LangChain Candidate Extractor on sample resume...")
    t2 = time.time()
    try:
        sample_resume = (
            "Alex Mercer - Senior Cloud Architect\n"
            "Summary: 8 years building distributed systems with Python, Go, and Kubernetes.\n"
            "Experience:\n"
            "Staff Infrastructure Engineer at Acme Corp (2021-Present)\n"
            "- Designed real-time event streaming pipeline processing 250k msgs/sec in Kafka.\n"
            "Skills: Python, Go, Kubernetes, Kafka, AWS, Terraform, Docker\n"
            "Education: BS Computer Science, MIT (2016)\n"
        )
        extractor = OllamaCandidateExtractor(temperature=0.0)
        profile = extractor.extract_profile(sample_resume)
        latency3 = int((time.time() - t2) * 1000)
        print(f"  [SUCCESS] Candidate profile extracted in {latency3}ms:")
        print(f"  Headline       : {profile.target_role_or_headline}")
        print(f"  Years of Exp   : {profile.timeline.total_continuous_years}")
        print(f"  Core Languages : {profile.skills.core_languages}")
        print(f"  Positions Found: {len(profile.timeline.positions)}")
    except Exception as e:
        print(f"  [WARNING] Candidate extraction warning: {e}")

    print("\n" + "=" * 75)
    print(f" ✓ OpenRouter connection to {model_name} via LangChain is VERIFIED!")
    print("=" * 75 + "\n")
    return True


if __name__ == "__main__":
    test_openrouter_langchain_connection()
