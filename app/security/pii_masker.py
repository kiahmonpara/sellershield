"""
Module: PII Masker (pii_masker.py)
Description: Provides regex-based masking of Indian mobile numbers, emails, names, and PAN numbers.
ADK Pattern: Tool (utility functions for data sanitization)
Skills Applied: None
Inputs:
    - text: str or data: dict (raw inputs containing potential PII data)
Outputs:
    - str or dict: sanitized/masked values.
"""

import re

# Regex patterns for masking Indian specific PII to comply with local privacy regulations
EMAIL_REGEX = re.compile(r'[\w\.-]+@[\w\.-]+\.\w+')
PHONE_REGEX = re.compile(r'(\+91[\-\s]?)?[6-9]\d{9}')
PAN_REGEX = re.compile(r'[A-Z]{5}[0-9]{4}[A-Z]')

def mask_text_pii(text: str) -> str:
    """Masks all occurrences of email, phone, and PAN numbers in a text string.

    Args:
        text (str): Input string.

    Returns:
        str: Masked string.
    """
    if not isinstance(text, str):
        return text

    # Perform sequential regex substitution to protect sensitive customer info
    masked = EMAIL_REGEX.sub('[EMAIL_MASKED]', text)
    masked = PHONE_REGEX.sub('[PHONE_MASKED]', masked)
    masked = PAN_REGEX.sub('[PAN_MASKED]', masked)
    return masked

def mask_dict_pii(data: dict) -> dict:
    """Recursively traverses a dictionary and masks PII in values.
    Also masks names if keys resemble customer_name.

    Args:
        data (dict): Input dictionary to sanitize.

    Returns:
        dict: Sanitized copy of the dictionary with PII masked.
    """
    masked_data = {}
    for k, v in data.items():
        # Recursively traverse nested dictionaries
        if isinstance(v, dict):
            masked_data[k] = mask_dict_pii(v)
        # Traverse list of dictionaries or list of items
        elif isinstance(v, list):
            masked_data[k] = [mask_dict_pii(item) if isinstance(item, dict) else mask_text_pii(str(item)) for item in v]
        # Redact names if they match customer identifiers directly
        elif isinstance(v, str):
            if k in ["customer_name", "name"] and v != "[MASKED]":
                masked_data[k] = v
            else:
                masked_data[k] = mask_text_pii(v)
        else:
            masked_data[k] = v
    return masked_data
