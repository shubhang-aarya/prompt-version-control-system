# Prompt Version Control System

A full-stack application for managing, versioning, and evaluating AI prompts.

The system provides a structured workflow for prompt development by allowing users to create prompt templates, maintain multiple prompt versions, build evaluation datasets, and compare prompt performance through automated evaluations.

---

## Project Overview

As AI applications become more dependent on prompt engineering, managing prompt iterations manually becomes difficult. Small changes in wording can significantly impact model outputs, making it important to track versions and evaluate changes systematically.

This project was built to explore how prompt workflows can be managed similarly to software development workflows, where prompts can be versioned, tested, compared, and promoted based on evaluation results.

---

## Features

### Prompt Management

* Create prompt templates with dynamic variables
* Organize prompts within a workspace
* Store prompt metadata

### Prompt Versioning

* Maintain multiple versions of a prompt
* Track prompt evolution over time
* Promote a selected version to production

### Dataset Management

* Create evaluation datasets
* Define test inputs
* Store evaluation rubrics and expected behavior

### Automated Evaluation

* Generate responses using an LLM
* Evaluate outputs against predefined criteria
* Store scores and evaluation history

### Dashboard Interface

* Centralized UI for managing prompts, datasets, versions, and evaluation results

---

## Architecture

```text
React + Vite Frontend
          |
          v
Node.js + Express Backend
          |
          v
SQLite Database
          |
          v
Groq API (LLM Inference)
```

---

## Tech Stack

### Frontend

* React
* Vite
* JavaScript
* CSS

### Backend

* Node.js
* Express.js

### Database

* SQLite
* better-sqlite3

### AI Integration

* Groq API (OpenAI-compatible)

---

## Project Structure

```text
Prompt-Version-Control-System/
│
├── frontend/
│   ├── src/
│   ├── components/
│   └── pages/
│
├── backend/
│   ├── routes/
│   ├── services/
│   ├── db/
│   ├── utils/
│   └── app.js
│
└── README.md
```

---

## Workflow

### 1. Create a Prompt

Example:

```text
You are a customer support assistant.

Reply professionally to this email:

{{email}}
```

### 2. Create Prompt Versions

Version 1:

```text
Reply professionally.
```

Version 2:

```text
Reply professionally and empathetically.
```

### 3. Create Evaluation Datasets

Example:

```json
{
  "email": "My order arrived damaged and I need a replacement."
}
```

### 4. Define Evaluation Criteria

Example rubric:

```text
Score professionalism, empathy, and helpfulness from 1–10.
```

Expected behavior:

```text
The response should acknowledge the issue, apologize, and provide next steps.
```

### 5. Run Evaluations

The system:

1. Fills template variables
2. Sends the prompt to the configured LLM
3. Generates a response
4. Evaluates the output
5. Stores scores and results

### 6. Compare Results

Different prompt versions can be compared using evaluation scores to identify higher-performing prompts.

---

## My Contributions

Implemented:

* Prompt creation and management workflow
* Prompt versioning system
* Dataset management functionality
* Evaluation pipeline
* Backend REST APIs
* SQLite persistence layer
* React dashboard UI
* Groq API integration
* Prompt execution and scoring workflow

---

## Challenges Encountered

Some engineering challenges addressed during development:

* Managing prompt variables across templates and datasets
* Designing a versioning workflow for prompts
* Building a reusable evaluation pipeline
* Integrating OpenAI-compatible LLM providers
* Maintaining consistency between prompt definitions and evaluation datasets
* Handling API failures and evaluation edge cases

---

## Running Locally

### Clone Repository

```bash
git clone <repository-url>
cd Prompt-Version-Control-System
```

### Backend Setup

```bash
cd backend
npm install
npm run migrate
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## Environment Variables

Create a `.env` file inside the backend directory:

```env
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.groq.com/openai/v1

OPENAI_MODEL=llama-3.3-70b-versatile
OPENAI_JUDGE_MODEL=llama3-8b-8192

PORT=4000
```

---

## Future Improvements

Planned enhancements:

* User authentication
* Team collaboration features
* Prompt diff viewer
* Prompt performance analytics
* Multi-provider LLM support
* Evaluation history tracking
* Export and import functionality
* Advanced comparison dashboard

---

## Screenshots

* Prompt Management
* <img width="1365" height="658" alt="Screenshot 2026-05-29 at 4 40 13 AM" src="https://github.com/user-attachments/assets/23483556-a5c8-4b43-b9b8-36073adf619b" />

* Prompt Versions
* <img width="1357" height="742" alt="Screenshot 2026-05-29 at 4 44 14 AM" src="https://github.com/user-attachments/assets/76c00786-ca02-49ea-84ca-c6dd46242689" />

* Evaluation Results
* <img width="1359" height="740" alt="Screenshot 2026-05-29 at 4 42 06 AM" src="https://github.com/user-attachments/assets/f1ca1cc9-eba6-47c5-92df-a4ff994b6b1a" />


