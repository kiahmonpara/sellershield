---
name: price-intelligence
description: Analyzes competitor pricing, price wars, and undercutting, and generates strategic repricing recommendations.
---

# Skill: price-intelligence

Tracks market price fluctuations, competitor undercuts, category price ranges, and psychological thresholds to generate optimal repricing actions and strategic guidance.

## When to use
Use this skill when auditing product competitor price lists to identify profit-optimized repricing recommendations and category placement.

## Repricing Urgencies

### 1. ACT_NOW
- Triggered if an active price war is detected.
- Or if the seller is currently being undercut by competitors and is labeled as `expensive`.
- Or if the seller price is just above a psychological threshold (e.g. ₹510 when ₹499 converts better).

### 2. MONITOR
- Triggered if systematic undercutting is detected by a competitor.
- Or if the seller's price occupies the `mid_range` and competitors are slightly below.

### 3. STABLE
- Triggered if the seller is the cheapest in the category or if no competitor has undercut the product.

## Strategic Directives

### 1. Compete
- Recommend lowering the seller price to match the cheapest competitor or round down to the nearest ₹99 threshold.

### 2. Premium
- Recommend maintaining the current price to defend margins, relying on quality or speed advantages.

### 3. Bundle
- Recommend packaging the main item with low-cost accessories (e.g., shoe laces, insoles) to bypass direct price comparisons.

### 4. Withdraw
- Recommend listing removal if competitive pressure has completely eroded the product's gross margins.
