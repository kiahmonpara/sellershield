import os
import json
import hashlib
from datetime import datetime
from app.security.pii_masker import mask_dict_pii

LOG_FILE = "data/audit_trail.jsonl"

def log_audit_event(agent_name: str, action: str, input_payload: any, output_summary: str, details: dict, module: str = "Return Fraud"):
    """Appends an event log to the append-only audit trail file.
    Masks PII recursively before saving.
    """
    # Ensure directory exists
    log_dir = os.path.dirname(LOG_FILE)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)

    # Hash the input payload to avoid storing PII while ensuring integrity trace
    input_str = json.dumps(input_payload, default=str)
    input_hash = "sha256:" + hashlib.sha256(input_str.encode('utf-8')).hexdigest()

    # Mask details dict recursively to remove phone, email, and names
    clean_details = mask_dict_pii(details)
    clean_summary = mask_dict_pii({"summary": output_summary})["summary"]

    event_id = "evt_" + hashlib.md5(f"{datetime.now().isoformat()}_{agent_name}_{action}".encode('utf-8')).hexdigest()[:12]

    log_entry = {
        "timestamp": datetime.now().isoformat() + "Z",
        "event_id": event_id,
        "module": module,
        "agent_name": agent_name,
        "action": action,
        "input_payload_hash": input_hash,
        "output_summary": clean_summary,
        "details": clean_details
    }

    # Append to JSONL file
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(log_entry) + "\n")
