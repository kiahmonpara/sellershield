---
name: audit-logger
description: Logs all agent decisions, scoring, and human reviews in an append-only JSONL format for audit trail integrity.
---

# Skill: audit-logger

Maintains a secure, append-only, tamper-evident log of all operations performed by ReturnSense agents. This satisfies the audit trail security requirement.

## When to use
Use this skill at each step transition in the orchestrator pipeline (e.g., after Ingestion, after Pattern Scoring, after Investigation, during Human Approval, and after Claim drafting).

## Log Location
Logs are saved in the data directory at `data/audit_trail.jsonl`. If parent directories do not exist, they should be initialized.

## Log Schema
Each line in the file must be a self-contained JSON object:
```json
{
  "timestamp": "2026-07-04T14:45:00.123Z",
  "event_id": "evt_abc123xyz",
  "agent_name": "pattern_agent",
  "action": "score_risk",
  "input_payload_hash": "sha256:d8a23e59f41b2...",
  "risk_level": "HIGH_RISK",
  "risk_score": 85,
  "details": {
    "customer_id": "C004",
    "signals_triggered": ["serial_returner", "cod_abuse"],
    "decision_reasoning": "Customer initiated 6 returns in 16 days across multiple marketplaces."
  }
}
```

## Security & Compliance Rules
- **Immutable & Append-Only**: NEVER overwrite, truncate, or rewrite past lines in the audit trail.
- **PII Stripping**: The skill must verify that no customer phone numbers (+91), email addresses, or unmasked names are written to `data/audit_trail.jsonl`.
- **Reasoning Log**: For every risk calculation result, the log must store the logic / reasons in the `decision_reasoning` attribute.
