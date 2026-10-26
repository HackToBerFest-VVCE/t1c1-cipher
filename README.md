# CIPHER | UNMYST
### Accessible Healthcare Information Platform

**Team CIPHER — Making healthcare information simpler, clearer, and more accessible.**

UNMYST is an accessible healthcare platform designed to help older adults and visually impaired individuals understand medical reports, prescriptions, and healthcare instructions more easily. It aims to reduce confusion caused by complex medical terminology, unclear document text, and accessibility barriers.

## Overview

Understanding medical documents can be challenging, particularly for individuals who experience visual difficulties or struggle with complex medical terminology. UNMYST aims to bridge this gap by providing an accessible interface for medical-document processing and healthcare information assistance.

## Key Features

- **Medical Document Processing:** Upload medical documents and extract available text.
- **Accessible Dashboard:** Navigate healthcare features through a simple, user-friendly interface.
- **Text-to-Speech:** Listen to extracted medical text.
- **Accessibility Controls:** Adjust text size and enable high-contrast display.
- **AI-Powered Explanations:** Planned integration of Gemma to help explain medical information in simpler language.
- **Healthcare Assistance:** Planned features include document history, reminders, and additional accessibility support.

> **Development note:** UNMYST is currently under development. Features identified as planned are not yet implemented.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Python, FastAPI, Uvicorn |
| UI Icons | Lucide React |
| AI Integration | Gemma — planned |
| Version Control | Git, GitHub |

## Project Structure

```text
UNMYST/
├── backend/
│   ├── main.py
│   └── requirements.txt
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   ├── api.ts
│   └── main.jsx
├── docs/
├── public/
├── index.html
├── package.json
├── package-lock.json
└── README.md
```

*The structure is illustrative; update it to reflect the actual repository contents.*

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3
- Git

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
cd UNMYST
```

Replace `YOUR_REPOSITORY_URL` with the repository's actual URL.

### 2. Run the Frontend

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in your terminal, typically `http://localhost:5173/`.

### 3. Run the Backend

Open a second terminal:

```bash
cd backend
python -m venv venv
```

Activate the environment.

**Windows PowerShell:**

```powershell
.\venv\Scripts\Activate.ps1
```

**Windows Git Bash:**

```bash
source venv/Scripts/activate
```

Install dependencies if `requirements.txt` exists:

```bash
pip install -r requirements.txt
```

Start the server:

```bash
python -m uvicorn main:app --reload --port 8000
```

Access the interactive API documentation at `http://127.0.0.1:8000/docs`.

## Development Status

| Component | Status |
|---|---|
| Frontend dashboard | Implemented |
| Basic backend setup | Implemented |
| PDF and TXT text extraction | Basic implementation |
| Text-to-speech | Implemented in the current interface |
| Gemma AI integration | Planned |
| OCR for scanned documents | Pending |
| Persistent document history | Pending |
| Healthcare reminders | Planned |
| Comprehensive accessibility testing | Pending |

## Documentation

The `docs/` directory can contain detailed technical documentation, including:

- `architecture.md` — System architecture and component interactions.
- `technical-design.md` — Technical decisions and implementation details.
- `implementation-plan.md` — Development phases and milestones.
- `sequence-diagram.md` — System request and response workflows.
- `specification