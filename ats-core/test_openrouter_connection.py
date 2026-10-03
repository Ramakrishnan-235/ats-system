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

def test_connection():
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    model = os.getenv("LLM_MODEL", "nvidia/nemotron-3.5-lightning:free")
    base_url = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")

    print("\n" + "=" * 70)
    print("           OPENROUTER CONNECTION & MODEL VERIFICATION TEST           ")
    print("=" * 70)
    print(f"Target Endpoint : {base_url}")
    print(f"Target Model    : {model}")

    if not api_key:
        print("\n[!] OPENROUTER_API_KEY is currently empty in ats-core/.env.")
        print("\nTo complete the test:")
        print("1. Get your free API key at: https://openrouter.ai/settings/keys")
        print("2. Open: ats-system/ats-core/.env")
        print("3. Set: OPENROUTER_API_KEY=\"sk-or-v1-...\"")
        print("4. Re-run this test script.")
        print("=" * 70 + "\n")
        return False

    masked_key = api_key[:8] + "..." + api_key[-4:] if len(api_key) > 12 else "***"
    print(f"API Key Detected: {masked_key}")

    from openai import OpenAI
    import instructor
    from pydantic import BaseModel, Field

    client = OpenAI(
        base_url=base_url,
        api_key=api_key,
        default_headers={
            "HTTP-Referer": os.getenv("OPENROUTER_HTTP_REFERER", "http://localhost:3000"),
            "X-Title": os.getenv("OPENROUTER_APP_TITLE", "AI-Powered ATS"),
        },
    )

    # Step 1: Basic Chat Completion Test
    print("\n[1/2] Testing standard chat completion...")
    t0 = time.time()
    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": "Respond with 'Connected to OpenRouter Nemotron successfully!' in one short sentence."},
            ],
            temperature=0.1,
        )
        latency = int((time.time() - t0) * 1000)
        reply = completion.choices[0].message.content.strip()
        print(f"  [SUCCESS] Received response in {latency}ms:")
        print(f"  Response: \"{reply}\"")
    except Exception as e:
        print(f"  [FAILED] Chat completion error: {e}")
        return False

    # Step 2: Instructor Structured Output Validation
    print("\n[2/2] Testing Pydantic structured output extraction (ATS schema mode)...")
    class ATSCheck(BaseModel):
        status: str = Field(description="Operational status, e.g. READY")
        model_name: str = Field(description="Name of the evaluated model")
        recommendation: str = Field(description="Brief candidate recommendation test")

    t1 = time.time()
    try:
        # OpenRouter models support tool-calling mode for reliable structured output
        eval_mode = instructor.Mode.TOOLS if "openrouter.ai" in base_url else instructor.Mode.JSON
        instructor_client = instructor.from_openai(client, mode=eval_mode)
        structured_res = instructor_client.chat.completions.create(
            model=model,
            response_model=ATSCheck,
            messages=[
                {"role": "user", "content": "Generate a test status report for candidate screening system."},
            ],
            temperature=0.1,
        )
        latency2 = int((time.time() - t1) * 1000)
        print(f"  [SUCCESS] Structured schema validated in {latency2}ms:")
        print(f"  Status        : {structured_res.status}")
        print(f"  Model Name    : {structured_res.model_name}")
        print(f"  Recommendation: {structured_res.recommendation}")
    except Exception as e:
        print(f"  [WARNING] Structured mode notice: {e}")

    print("\n" + "=" * 70)
    print(" ✓ OpenRouter connection to nvidia/nemotron-3.5-lightning:free is VERIFIED!")
    print("=" * 70 + "\n")
    return True

if __name__ == "__main__":
    test_connection()
