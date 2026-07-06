---
name: alert-generator
description: Guidelines for generating structured notifications and alerts based on analysis anomalies.
---

# Alert Generator Skill

Use this skill to translate analysis anomalies into plain-English alerts.

## Guidelines:
1. **Critical Alerts**: Triggered by immediate actions (e.g. HIGH_RISK fraud customer, MANIPULATED reviews, or active price wars).
2. **Warning Alerts**: Triggered by threats needing attention (e.g. MEDIUM_RISK customer, SUSPICIOUS reviews, or competitor undercutting).
3. **Info Alerts**: Informational messages (e.g. scan completed, new competitor detected, claim filed).
4. **Length**: Title max 60 chars. Description max 120 chars.
5. **No Duplicates**: Never create duplicate alerts for the same event.
