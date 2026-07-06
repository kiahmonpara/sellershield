---
name: fraud-signals
description: Detects return fraud patterns in Indian D2C e-commerce order/return data.
---

# Skill: fraud-signals

Detects return fraud patterns in Indian e-commerce order and return datasets. It evaluates multiple risk vectors, aggregates weights, and computes an overall fraud risk score.

## When to use
Use this skill when processing customer transactional histories or specific return actions to calculate fraud probability and flag accounts for closer inspection.

## Fraud Signals to Detect

### 1. Serial Returner (weight: 30 pts)
- Triggered if a customer initiates `>3` returns within any 30-day window.
- Or if returns are observed across multiple platforms (e.g., Amazon, Flipkart, Meesho) for the same `customer_id`.

### 2. Swap Fraud (weight: 35 pts)
- Triggered if the returned package weight (`return_weight_g`) is `< 50%` of the original weight (`original_weight_g`).
- Or if `return_reason` is `"wrong_item"` and the weight discrepancy between original and returned item is `> 200g`.

### 3. COD Abuse (weight: 20 pts)
- Triggered if `payment_mode` is `COD` and the customer has `>2` returns.
- Or if the customer repeatedly chooses COD and returns items citing `"not_as_described"` or `"wrong_color"`.

### 4. Address/Identity Ring (weight: 25 pts)
- Triggered if multiple orders from the same city have the exact same `order_value_inr` but are placed under different customer names.
- Or if a single address is associated with `>3` returned orders.

### 5. Policy Exploit (weight: 15 pts)
- Triggered if the customer consistently initiates returns within 48 hours of delivery.
- Or if `return_reason` alternates between generic claims (e.g. `"not_as_described"` and `"wrong_color"`).

## Risk Score Calculation & Action Heuristics

The risk score is calculated as the sum of all triggered signal weights, capped at a maximum of 100:

$$\text{score} = \min\left(100, \sum \text{triggered\_signal\_weights}\right)$$

* **Score >= 70**: **HIGH_RISK** (Auto-flagged for claim drafting, requires human confirmation).
* **Score >= 40**: **MEDIUM_RISK** (Flagged for manual review, skipped for auto-claims).
* **Score < 40**: **LOW_RISK** (Clean account, approved).

### Safety Overrides
- A customer with `0` or `1` total returns in their lifetime history MUST NEVER be classified as HIGH_RISK.
- Always generate an evidence object detailing which flags were triggered and the supporting values.

## Output Schema
```json
{
  "customer_id": "C004",
  "customer_name": "[MASKED]",
  "risk_score": 85,
  "risk_level": "HIGH_RISK",
  "signals_triggered": ["serial_returner", "cod_abuse"],
  "evidence": {
    "return_count": 6,
    "return_window_days": 16,
    "total_return_value_inr": 17700,
    "platforms_abused": ["Flipkart", "Meesho"]
  }
}
```
