# SkillMatch AI: System Architecture & Data Schema

## 1. System Architecture Diagram
The platform follows a modern **Decoupled AI-Driven Architecture**, where the frontend (Quantum UI) communicates with a specialized Node.js middleware that orchestrates interactions between external Job APIs and AI reasoning engines.

```mermaid
graph TD
    subgraph "Client Layer (Frontend)"
        UI["Quantum-Grid UI (Vanilla JS/CSS)"]
        Canvas["Particle Globe Engine (Canvas API)"]
        Chat["AI Chat Interface"]
    end

    subgraph "Intelligence Layer (API Gateway)"
        Node["Node.js / Express Server"]
        Auth["Session Management (Local/JWT)"]
    end

    subgraph "External Integration Layer"
        Adzuna["Adzuna Job API (Market Data)"]
        JSearch["JSearch (Deep Query)"]
        GenAI["Gemini / HuggingFace (LLM Analysis)"]
    end

    subgraph "Data & Analytics"
        TF["TF-IDF Vector Search Engine"]
        Matcher["Hybrid Scoring Algorithm"]
        Schema["Local Schema (JSON/BSON)"]
    end

    UI --> Node
    Node --> Adzuna
    Node --> JSearch
    Node --> GenAI
    Node --> Matcher
    Matcher --> TF
```

---

## 2. Database Schema Overview
The data model is designed for high-speed skill matching and persistent career roadmap tracking. It is currently optimized for a document-based structure.

```mermaid
erDiagram
    USER ||--o{ SKILL : possesses
    USER ||--o{ CAREER_GOAL : pursues
    JOB ||--|{ SKILL_REQUIREMENT : demands
    USER ||--o{ ROADMAP : generates

    USER {
        string userId PK
        string email
        string current_role
        string experience_level
    }

    SKILL {
        string skillId PK
        string name
        int proficiency_level
        string domain
    }

    JOB {
        string jobId PK
        string title
        string company
        float matching_score
        string region
    }

    ROADMAP {
        string roadmapId PK
        string target_role
        list milestones
        float progress_pct
    }
```

---

## 3. High-Level Engine Performance Fixes
To resolve the **Lagging** experienced on the dashboard, the following optimizations have been implemented:
1. **Synapse Memoization**: Connection lines between continental particles are no longer re-calculated every frame ($O(N^2)$ reduction).
2. **Context Batching**: Canvas drawing operations for the 'Quantum Earth' have been batched to reduce GPU context switching.
3. **Throttled Rasterization**: Non-essential atmospheric effects are rendered at a lower frequency to prioritize UI responsiveness.
