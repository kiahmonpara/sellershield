# SellerShield - Stride Co. Architecture

This document details the system architecture of SellerShield, showing how all components, agent pipelines, shared layers, and MCP servers connect.

## System Architecture

```mermaid
graph TD
    %% User and Web Stack
    User[User] -->|Interacts| Frontend[Frontend: Next.js]
    Frontend -->|REST API Calls| Backend[FastAPI Backend]
    
    %% Backend Orchestration
    Backend -->|Invokes| RootOrch[Root Orchestrator Agent]

    subgraph "Return Fraud Pipeline (Sequential)"
        ingestion_agent[ingestion_agent] -->|Validates/Normalizes| pattern_agent[pattern_agent]
        pattern_agent -->|6 Risk Signals Scored| investigation_agent[investigation_agent]
        investigation_agent -->|High Risk Dossiers| claim_agent[claim_agent]
        claim_agent -->|Draft Platform Claims| claims_intelligence_agent[claims_intelligence_agent]
    end

    subgraph "Review Authenticity Pipeline (Parallel & Sequential)"
        linguistic_agent[linguistic_agent]
        network_agent[network_agent]
        linguistic_agent & network_agent -->|Parallel Scoring| verdict_agent[verdict_agent]
        verdict_agent -->|Adjusted Rating & Verdict| response_agent[response_agent]
    end

    subgraph "Price Intelligence Pipeline (Sequential)"
        monitor_agent[monitor_agent] -->|Price History & Alerts| analysis_agent[analysis_agent]
        analysis_agent -->|Competitor Gaps & Position| strategy_agent[strategy_agent]
    end

    %% Routing from Root Orchestrator
    RootOrch --> IngestionRouter[Return Fraud Router] --> ingestion_agent
    RootOrch --> ReviewRouter[Reviews Router] --> linguistic_agent & network_agent
    RootOrch --> PriceRouter[Pricing Router] --> monitor_agent

    %% Shared Security & Compliance Layer
    subgraph "Shared Security & Compliance Layer"
        pii_masker[pii_masker]
        human_review[human_review Gate]
        audit_logger[audit_logger]
    end

    %% Data Connections
    claims_intelligence_agent -->|Mandatory Check| human_review
    human_review -->|Terminal Consent| audit_logger
    ingestion_agent & verdict_agent & strategy_agent --> pii_masker
    pii_masker --> audit_logger

    %% Data Stores
    subgraph "Data Storage"
        outputs["data/output/*.json"]
        audit_file["data/audit_trail.jsonl"]
    end
    
    claims_intelligence_agent -->|Saves results| outputs
    verdict_agent -->|Saves results| outputs
    strategy_agent -->|Saves results| outputs
    audit_logger -->|Appends logs| audit_file

    %% MCP Servers
    subgraph "Model Context Protocol (MCP) Servers"
        fs_mcp["filesystem-mcp"]
        docs_mcp["adk-docs-mcp"]
    end
    
    fs_mcp -.->|Reads raw input / Writes output| IngestionRouter & outputs & audit_file
    docs_mcp -.->|Antigravity Context generation| RootOrch

    %% Skills
    subgraph "Agent Skills"
        chat_skill["chat-assistant Skill"]
    end
    
    chat_skill -.->|PII Masking & Formatting Rules| RootOrch
```

---

## Fraud Pipeline Agent Flow (Quick Architecture View)

```mermaid
graph LR
    input_csv[returns.csv] --> ingestion_agent
    ingestion_agent -->|Structured Records| pattern_agent
    pattern_agent -->|Fraud Scored Profiles| investigation_agent
    investigation_agent -->|High Risk Evidence Dossiers| claim_agent
    claim_agent -->|Draft Platform Claims| claims_intelligence_agent
    claims_intelligence_agent -->|Final Optimized Claims| human_review[Human Approval Gate]
    human_review -->|Approved| audit_trail[(audit_trail.jsonl)]
```
