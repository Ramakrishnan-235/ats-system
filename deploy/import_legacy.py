"""Back up the legacy database and import into an explicitly selected workspace.

Default is export-only. Applying requires --apply, --owner-email and
--workspace-id. Credentials are prompted privately or read from
ATS_IMPORT_PASSWORD; no credentials or candidate details are printed.
Old vectors/scores are retained in the source backup, not used as fresh results.
"""
import argparse
import getpass
import json
import os
import subprocess
from datetime import UTC, datetime
from pathlib import Path

import httpx

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--container",default="ats-postgres")
    parser.add_argument("--source",default="legacy-ats-db")
    parser.add_argument("--core-url",default="http://127.0.0.1:8080")
    parser.add_argument("--owner-email")
    parser.add_argument("--workspace-id")
    parser.add_argument("--apply",action="store_true")
    args=parser.parse_args()
    if args.apply and (not args.owner_email or not args.workspace_id):
        parser.error("Applying requires the workspace owner's account email and explicit destination workspace UUID")
    backup=ROOT/".local-backups"/datetime.now(UTC).strftime("legacy-%Y%m%dT%H%M%SZ")
    backup.mkdir(parents=True,exist_ok=False)
    command=["docker","exec",args.container]
    archive=subprocess.run([*command,"pg_dump","-U","ats_user","-d","ats_db","-Fc"],capture_output=True,check=True)
    (backup/"legacy.dump").write_bytes(archive.stdout)
    sql="SELECT jsonb_build_object('jobs',(SELECT coalesce(jsonb_agg(to_jsonb(j)-'embedding'-'embedding_legacy_pre_gemma2'),'[]') FROM job_postings j),'candidates',(SELECT coalesce(jsonb_agg(to_jsonb(c)-'embedding'-'embedding_legacy_pre_gemma2'),'[]') FROM candidates c),'applications_count',(SELECT count(*) FROM applications),'audits_count',(SELECT count(*) FROM scoring_audits))"
    output=subprocess.run([*command,"psql","-U","ats_user","-d","ats_db","-At","-c",sql],capture_output=True,check=True)
    source=json.loads(output.stdout)
    (backup/"source.json").write_text(json.dumps(source,indent=2),encoding="utf-8")
    jobs=[]
    for row in source["jobs"]:
        jobs.append({"source_id":row["id"],"status":str(row.get("status") or "OPEN").upper(),"job":{"title":row["title"],"department":row.get("department") or "","location":row.get("location") or "","job_description":row.get("job_description") or "","min_years_experience":float(row.get("min_years_experience") or 0),"required_skills":row.get("required_skills") or []}})
    candidates=[]
    for row in source["candidates"]:
        original=row.get("structured_profile") or {}
        profile={k:original.get(k,row.get(k)) for k in ("target_headline","role","core_skills","experience","highest_education","years_of_experience") if original.get(k,row.get(k)) is not None}
        contact={k:original[k] for k in ("name","email","phone","linkedin","location") if isinstance(original.get(k),str)}
        candidates.append({"source_id":row["id"],"profile":profile,"contact":contact})
    payload={"source":args.source,"dry_run":True,"jobs":jobs,"candidates":candidates}
    (backup/"import.json").write_text(json.dumps(payload,indent=2),encoding="utf-8")
    print(f"Legacy backup saved locally. Jobs: {len(jobs)}; candidates: {len(candidates)}; applications: {source['applications_count']}; scoring audits: {source['audits_count']}.")
    if not args.apply:
        print("Export-only: no destination records were written.")
        return
    if source["applications_count"] or source["audits_count"]:
        raise RuntimeError("Legacy application/audit history needs an explicit mapping; backup preserved and import refused")
    password=os.getenv("ATS_IMPORT_PASSWORD") or getpass.getpass("Workspace owner's password: ")
    with httpx.Client(base_url=args.core_url,headers={"origin":"http://localhost:3000"},timeout=120,follow_redirects=False) as client:
        client.post("/api/v1/auth/login",json={"email":args.owner_email,"password":password}).raise_for_status()
        client.post("/api/v1/auth/workspace",json={"tenant_id":args.workspace_id}).raise_for_status()
        who=client.get("/api/v1/auth/me");who.raise_for_status()
        if who.json()["user"]["tenant_id"]!=args.workspace_id or who.json()["user"]["role"] not in ("owner","admin"):
            raise RuntimeError("Destination workspace and administrator identity were not verified")
        preview=client.post("/api/v1/migration/import",json=payload);preview.raise_for_status()
        payload["dry_run"]=False
        saved=client.post("/api/v1/migration/import",json=payload);saved.raise_for_status()
        (backup/"mapping.json").write_text(json.dumps(saved.json(),indent=2),encoding="utf-8")
        client.post("/api/v1/auth/logout").raise_for_status()
    print("Import verified. Candidates require original resume processing; source database and backup were retained.")

if __name__=="__main__":
    main()
