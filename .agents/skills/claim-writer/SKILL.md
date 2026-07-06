---
name: claim-writer
description: Formats collected fraud and discrepancy evidence into copy-pasteable marketplace claim documents.
---

# Skill: claim-writer

Formats evidence dossiers compiled by the Investigation Agent into structured, platform-appropriate claim templates (e.g., Amazon SAFE-T, Flipkart SPF, Myntra PPP, Meesho Seller Claim, or a Generic format).

## When to use
Use this skill when a customer has been classified as `HIGH_RISK` and approved by the human reviewer. This skill turns raw analytical evidence into structured arguments that marketplaces require to process merchant reimbursements.

## Claim Templates

### 1. Generic Marketplace Template
For general channels and direct storefronts:
```markdown
### RETURN DISCREPANCY & LOSS CLAIM
**Date**: [DATE]
**Claim Reference**: [ORDER_ID]
**Platform**: [PLATFORM]
**Customer Identifier**: [MASKED_CUSTOMER_NAME] ([CUSTOMER_ID])

#### Summary of Issue:
We are claiming compensation for a return shipment discrepancy. The returned package does not match the original goods dispatched.

#### Detailed Evidence:
- **Discrepancy Type**: [DISCREPANCY_REASON]
- **Original weight shipped**: [ORIGINAL_WEIGHT]g
- **Weight returned**: [RETURN_WEIGHT]g
- **Weight Loss/Delta**: [WEIGHT_DELTA]g ([WEIGHT_DELTA_PERCENT]%)
- **Return Reason Claimed**: [RETURN_REASON]

#### Risk Analysis Metrics:
- **Return fraud score**: [RISK_SCORE]/100
- **Identified Risk Vectors**: [RISK_VECTORS]
- **Total return frequency (past 30d)**: [RETURN_COUNT]

Please review the attached evidence dossier and process the reimbursement.
```

### 2. Amazon SAFE-T Claim Template
Specifically targets Amazon's SAFE-T format:
```markdown
Amazon SAFE-T Claim Filing
--------------------------------------
Order ID: [ORDER_ID]
Reason: Item returned was damaged / wrong item / empty package.

Description of Issue:
The buyer returned an item that has a significant weight discrepancy. The outbound shipment weight was [ORIGINAL_WEIGHT]g. The returned package weight was measured at [RETURN_WEIGHT]g, representing a [WEIGHT_DELTA_PERCENT]% reduction. The return reason stated was '[RETURN_REASON]'. This customer exhibits serial return characteristics with a ReturnSense Risk Score of [RISK_SCORE]/100. Please issue a refund.
```

### 3. Flipkart SPF (Seller Protection Fund) Template
Specifically targets Flipkart's SPF format:
```markdown
Flipkart SPF Claim Submission
-----------------------------
Order ID: [ORDER_ID]
Return ID: [RETURN_ID]
SPF Claim Category: Wrong Product Received / Weight Discrepancy

Detailed Description:
We received a return for Order ID [ORDER_ID]. The product returned is incorrect. 
- Original Dispatch Weight: [ORIGINAL_WEIGHT]g
- Return Received Weight: [RETURN_WEIGHT]g
- Discrepancy Margin: [WEIGHT_DELTA]g
- Return Reason selected: [RETURN_REASON]

We request the SPF committee to reimburse the order value of INR [ORDER_VALUE] due to customer return policy abuse.
```

## Rules
- ALWAYS mask the customer name in the claim text (use `[MASKED]`).
- Do NOT output any raw customer emails, phone numbers, or physical addresses in the claim text.
- Formats must be valid plain-text/Markdown, ready for copy-pasting.
