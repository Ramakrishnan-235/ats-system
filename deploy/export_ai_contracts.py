"""Generate private JSON schemas from the actual Pydantic contract classes."""
import json
from pathlib import Path
from ats_core.ai_api.contracts import AIResult,Dispatch

root=Path(__file__).resolve().parents[1]/"contracts"
root.mkdir(exist_ok=True)
for filename,model in [("ai-job-v1.schema.json",Dispatch),("ai-result-v1.schema.json",AIResult)]:
    schema=model.model_json_schema()
    schema["$schema"]="https://json-schema.org/draft/2020-12/schema"
    (root/filename).write_text(json.dumps(schema,indent=2)+"\n",encoding="utf-8")
