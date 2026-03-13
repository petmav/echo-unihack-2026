"""
FastAPI routers for Echo backend.

All routes are prefixed with /api/v1 in the main app.

Privacy invariant enforced across all routers:
- Raw thought text is NEVER logged or persisted
- Only anonymized + humanized content reaches Elasticsearch
- No account_id linkage in Elastic documents
"""
