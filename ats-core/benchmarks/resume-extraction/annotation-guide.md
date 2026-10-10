# Resume extraction annotation guide

Version: 1. The initial corpus is an author-checked synthetic pilot. Independent
recruiter review and a larger consented corpus are required before production claims.

- Read the original PDF, including scanned pages. Do not derive labels from parser output.
- A positive skill is explicitly claimed or personally applied. Record a whole supporting
  sentence/list and its one-based page. Keep aliases mapped to the frozen canonical name.
- Negative statements, aspiration, job requirements and another team's technology do
  not establish the candidate's skill. Label those as `negative_skills`.
- Mentioning Docker does not imply Kubernetes. Do not infer an unstated programming
  language or tool from a related technology.
- Record explicitly supported skills outside the approved catalog too. They are catalog
  gaps, excluded from approved-catalog recall but included in all-skill coverage.
- Contact values are exact, phones use E.164, missing values are null. Only whitespace
  and case are normalized for field scoring. Education is the stated qualification line.
- Employment labels are complete company/role/start/end entries. Projects are not
  employment. Current pilot dates have month precision; the scorer matches the month
  of an ISO day date but does not repair or infer dates. Add a richer date schema before
  introducing year-only/uncertain-date gold labels.
- Positive evidence is stricter than source containment. The benchmark separately checks
  source grounding and containment of an entire positive gold quote. This strict quote
  proxy can reject alternate valid wording and is not semantic entailment validation.
- Gold page numbers document the annotation location. They do not become predicted
  page references. Only actual parser-supplied page metadata counts toward coverage.
- Group every version of a person's resume together. Near-duplicate content/template
  variants must share a group. Never tune on the held-out test split.
- Keep provenance, permission, file hash and page count. Public availability alone is
  insufficient provenance for this corpus; use synthetic or explicitly consented evaluation.
- Review label disagreements against the PDF, record annotation changes, bump dataset
  version and retain earlier run hashes. Never edit gold labels to make the parser pass.
