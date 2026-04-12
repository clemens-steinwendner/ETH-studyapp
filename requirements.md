# Software Requirements Specification (SRS)
**Project Title:** ETH AI Study Assistant  
**Target Environment:** Localhost (Apple Silicon M3 Max)  

---

## 1. Introduction

### 1.1 Purpose
The purpose of this document is to specify the software requirements for the "ETH AI Study Assistant." It provides developers, architects, and stakeholders with a detailed blueprint of the system's intended behavior, constraints, and operational standards.

### 1.2 Document Conventions
* **FR-xx**: Functional Requirement.
* **NFR-xx**: Non-Functional Requirement.
* **Priority Levels**: Must Have (Critical), Should Have (Important), Could Have (Nice to have).

### 1.3 Intended Audience
This document is intended for software developers, UI/UX designers, and systems architects responsible for building, testing, and deploying the application.

### 1.4 Product Scope
The ETH AI Study Assistant is a locally-isolated web application for a computer science student at ETH Zurich. It ingests course materials (PDFs) and uses generative AI to create interactive study sessions. The system covers Databases, Computer Networks, Probability & Statistics, Formal Methods (FMFP), and Machine Learning, featuring sandboxed code execution, text evaluation, and visual math proof grading.

### 1.5 Definitions and Acronyms
* **RAG**: Retrieval-Augmented Generation.
* **E2B**: Ephemeral isolated microVMs used for code execution.
* **LLM**: Large Language Model.

---

## 2. Overall Description

### 2.1 Product Perspective
The system operates as a standalone, locally hosted client-server application. It does not rely on cloud databases or cloud hosting for the application layer. It interacts with third-party APIs exclusively for AI inference and sandboxed code execution.

### 2.2 User Characteristics
* **Primary User**: Single user, technical (CS student).
* **Expectations**: Familiar with IDEs, terminals, and command-line interfaces. Requires high accuracy in mathematical and logical evaluations.

### 2.3 Operating Environment
* **Hardware**: Apple Silicon M3 Max (Host machine).
* **Backend Server**: Python-based API server (running locally).
* **Frontend**: SPA or SSR web framework (running locally).
* **Database**: Local relational database (for state) and local vector database (for embeddings).

### 2.4 Design and Implementation Constraints
* The system must not exceed an operational API budget of $8.00 USD per month.
* The backend must support asynchronous, long-running processes without relying on serverless function timeouts.

---

## 3. Functional Requirements (FR)

### 3.1 Document Ingestion & RAG Pipeline
* **FR-01 [PDF Text Parsing]:** The backend shall extract text natively from uploaded digital-native PDFs. *(Must Have)*
* **FR-02 [Metadata Extraction & Storage]:** Upon ingestion, the system shall extract document metadata (filename, detected chapters, upload date) and store it in the local relational database to enable future context filtering. *(Must Have)*
* **FR-03 [Math Preservation]:** The parsing pipeline shall identify mathematical formulas and retain them as standard LaTeX string formats. *(Must Have)*
* **FR-04 [Diagram Extraction & Processing]:** The ingestion pipeline shall automatically detect and extract embedded image blocks from the PDF. The system shall pass these images to a Vision LLM to generate a searchable, semantic text description, which is then embedded alongside the image reference. *(Should Have)*
* **FR-05 [Manual Diagram Override]:** The UI shall provide a mechanism for the user to manually upload context images or diagrams to a study session in the event that the automated PDF extraction pipeline fails or misses visual data. *(Must Have)*
* **FR-06 [Vector Embedding]:** Parsed text and diagram descriptions shall be embedded and stored in a local vector database. *(Must Have)*

### 3.2 Study Session Configuration (Dashboard)
* **FR-07 [Context Selection]:** The UI shall allow the user to select specific documents, chapters, or past exams (queried from the relational database) to set the context boundary for a new study session. *(Must Have)*
* **FR-08 [Parameter Controls]:** The user shall be able to configure the number of questions, difficulty level (Recall, Application, Synthesis), and desired question types (Coding, Multiple Choice, Open-Ended). *(Must Have)*
* **FR-09 [Hint Toggle]:** The system shall include a toggleable hint feature. If enabled, the UI renders a collapsible button below questions that requests a conceptual nudge from the LLM. *(Must Have)*

### 3.3 Active Study & UI Mechanics
* **FR-10 [Code Editor Integration]:** The UI shall provide a code editing interface with syntax highlighting support for SQL, Haskell, Python, and LaTeX. *(Must Have)*
* **FR-11 [Terminal Output]:** The frontend shall provide a terminal-like view to display standard output, standard error, and test results returned from the execution sandbox. *(Must Have)*
* **FR-12 [Image Upload]:** The UI shall provide a drag-and-drop zone for users to upload image files (e.g., handwritten math proofs) as answers to Open-Ended questions. *(Must Have)*

### 3.4 Code Execution & Evaluation
* **FR-13 [Test Case Generation]:** When the system dynamically generates a coding exercise, it shall simultaneously prompt the LLM to generate corresponding deterministic unit tests (e.g., pytest for Python) to evaluate the user's future submission. *(Must Have)*
* **FR-14 [Sandbox Routing]:** When the user triggers execution, the backend shall bundle the user's code with the dynamically generated test cases and send them to an isolated ephemeral sandbox via API. *(Must Have)*
* **FR-15 [Deterministic Grading]:** The system shall evaluate code correctness using standard, deterministic test runners executed within the sandbox. The LLM shall *not* be used to parse standard output to determine a pass/fail state. *(Must Have)*
* **FR-16 [Tutor Feedback Generation]:** If the deterministic test fails, the backend shall pass the error output and the user's code to the LLM to generate tutor-style feedback, pointing out logical or syntax errors. *(Must Have)*
* **FR-17 [Vision-Based Grading]:** Uploaded handwritten proofs shall be evaluated by a Vision LLM to verify the derivation step-by-step and return text highlighting any logical flaws. *(Must Have)*
* **FR-18 [Grading Dispute]:** The UI shall provide a mechanism for the user to override an LLM evaluation and manually mark an exercise as 'Passed' in the event of an LLM hallucination or incorrect vision evaluation. *(Must Have)*

### 3.5 Subject-Specific Modalities
* **FR-19 [Database Mocking]:** For SQL questions, the backend shall inject a standard, pre-defined relational schema into the sandbox environment before executing the user's query and the assertion tests. *(Must Have)*
* **FR-20 [FMFP Support]:** The system shall support Haskell compilation and execution within the sandbox environment. *(Must Have)*

### 3.6 State & Progress Management
* **FR-21 [Session Logging]:** Every generated exercise, the user's submission, and the Boolean evaluation result (Pass/Fail) shall be saved to the local relational database. *(Must Have)*
* **FR-22 [Spaced Repetition/Retry]:** The system shall allow the user to query the relational database to generate a study session comprised exclusively of past exercises marked as "Failed." *(Should Have)*
* **FR-23 [API Budget Enforcement]:** The backend shall calculate and track cumulative token costs and sandbox runtime costs for all API interactions. If the calculated monthly cost exceeds $8.00 USD, the system shall strictly disable generative features and present a budget-exceeded warning via the UI. *(Must Have)*

---

## 4. External Interface Requirements

### 4.1 User Interfaces (UI)
* **Web Browser:** The application shall render functionally on modern Chromium-based browsers and Safari.
* **Responsiveness:** The layout shall utilize a split-pane design (e.g., instructions/questions on one side, editor/terminal on the other) optimized for minimum screen resolutions of 1280x800.

### 4.2 Software Interfaces (APIs)
* **LLM API:** The backend shall communicate with the designated LLM provider via REST API for text/vision generation.
* **Sandbox API:** The backend shall communicate with the sandbox provider SDK to provision microVMs, execute code, and retrieve standard output.

---

## 5. Non-Functional Requirements (NFR)

### 5.1 Performance & Latency
* **NFR-01 [Time-to-First-Token]:** During generative tasks, the backend shall begin streaming the first text token to the frontend within 800ms of receiving the initial LLM API response.
* **NFR-02 [Execution Turnaround]:** MicroVM sandbox provisioning, code execution, and stdout retrieval shall complete within 5.0 seconds at the 95th percentile.
* **NFR-03 [Local Ingestion Speed]:** Local RAG ingestion, PDF parsing, and vector embedding for a standard text-heavy 50-page PDF shall complete in under 60 seconds.

### 5.2 Security & Privacy
* **NFR-04 [Code Isolation]:** User-submitted code and LLM-generated test scripts shall never be executed directly on the host machine. All execution must occur within the external microVM environment.
* **NFR-05 [Data Localization & Transmission]:** Data at rest (course materials, embeddings, user state) must remain stored locally on the host machine. Ephemeral transmission of document snippets, code, and images to the designated LLM/Sandbox APIs for inference is permitted, strictly provided the providers' terms of service guarantee zero-data-retention and no model training.

### 5.3 Maintainability & Architecture
* **NFR-06 [Decoupled Architecture]:** The frontend and backend shall remain strictly decoupled, communicating exclusively via documented RESTful endpoints or WebSockets (for output streaming).
* **NFR-07 [Extensibility]:** The execution sandbox pipeline shall be modularized such that adding a new programming language execution environment requires modifying configuration files rather than core routing logic.