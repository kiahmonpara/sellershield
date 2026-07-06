---
name: delta-detector
description: Guidelines for comparing previous runs and identifying new threats (fraud, reviews, pricing).
---

# Delta Detector Skill

Use this skill to compare the active run with the previous run to identify new threats.

## Guidelines:
1. **New Fraud Threats**: Compare customer IDs between the current high/medium risk profiles and the previous run's profiles. Identify any customer IDs present in the current run that were not in the previous run.
2. **New Fake Reviews**: Compare reviews flagged as fake. Identify any review IDs or new burst clusters that were not in the previous run.
3. **New Price Undercuts**: Compare product competitor price gaps. Identify any product IDs where competitor pricing has changed to undercut Stride Co.'s price since the last scan.
