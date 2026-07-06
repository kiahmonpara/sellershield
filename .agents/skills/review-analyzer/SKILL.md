---
name: review-analyzer
description: Detects review manipulation, authenticity, and fake review patterns on product reviews.
---

# Skill: review-analyzer

Evaluates product review authenticity by tracking linguistic fraud patterns and group network behaviors. It aggregates signal scores to compute a final authenticity score, classifying reviews and products.

## When to use
Use this skill when processing collections of product reviews to verify authenticity, adjust star ratings, and detect fake review syndicates or temporal bursts.

## Linguistic Signals to Detect

### 1. Generic Praise (weight: 25 pts)
- Triggered if review text is under 30 words, contains generic praise keywords (e.g., "great", "nice", "perfect"), and does not mention footwear-specific keywords (e.g., "sole", "lace", "fit", "run").

### 2. Sentiment-Rating Mismatch (weight: 30 pts)
- Triggered if the review text is positive (e.g., "love", "excellent") but rating is $\le 2$, OR if text is negative (e.g., "bad", "terrible") but rating is $\ge 4$.

### 3. Keyword Stuffing (weight: 20 pts)
- Triggered if words from the product title appear verbatim more than twice in the review text.

### 4. Superlative Overuse (weight: 15 pts)
- Triggered if the review contains more than 3 superlatives (e.g., "best", "most", or words ending in "est").

### 5. Suspiciously Short (weight: 10 pts)
- Triggered if the review is under 8 words long and rated 5 stars.

## Network & Group Signals

### 1. Temporal Burst (score contribution: 30 pts)
- Triggered if $\ge 5$ reviews are posted within any sliding 24-hour window.

### 2. Reviewer Velocity (score contribution: 25 pts)
- Triggered if a reviewer posts $\ge 5$ reviews across the platform in 7 days, or appears multiple times in the scan.

### 3. Single-Product Reviewer (score contribution: 10 pts)
- Triggered if a reviewer has a total account review count of 1.

### 4. Verified Purchase Rate (score contribution: 20 pts)
- Triggered if the verified purchase rate among 4-star+ reviews is $< 40\%$.

### 5. Zero Helpful Votes Cluster (score contribution: 15 pts)
- Triggered if $\ge 60\%$ of reviews have 0 helpful votes.

## Authenticity Score & Verdict

The product authenticity score is calculated by merging linguistic authenticity (100 - average linguistic spam score) and network authenticity (100 - network spam score):

$$\text{authenticity\_score} = (\text{linguistic\_authenticity} \times 0.6) + (\text{network\_authenticity} \times 0.4)$$

* **Score >= 70**: **TRUSTWORTHY** (Authentic review footprint).
* **Score >= 40**: **SUSPICIOUS** (Minor manipulation detected).
* **Score < 40**: **MANIPULATED** (High probability of review manipulation).
