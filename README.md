# UNMYST — Accessible Healthcare Information Platform

### Team CIPHER

**Making Healthcare Information Accessible, Understandable, and Actionable**

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Our Solution](#our-solution)
4. [Objectives](#objectives)
5. [Key Features](#key-features)
6. [System Architecture](#system-architecture)
7. [Technology Stack](#technology-stack)
8. [Project Structure](#project-structure)
9. [Application Workflow](#application-workflow)
10. [Installation and Setup](#installation-and-setup)
11. [Backend API](#backend-api)
12. [AI and Document Processing](#ai-and-document-processing)
13. [Accessibility and User Experience](#accessibility-and-user-experience)
14. [Privacy and Security](#privacy-and-security)
15. [Current Implementation](#current-implementation)
16. [Future Scope](#future-scope)
17. [Responsible Use](#responsible-use)
18. [Team](#team)

---

## 1. Overview

**UNMYST** is a healthcare accessibility platform designed primarily for older adults and people with visual impairments who may experience difficulties reading, interpreting, and managing medical information.

Medical documents frequently contain technical terminology, abbreviations, laboratory measurements, and instructions that can be challenging to understand without assistance. UNMYST aims to reduce these barriers through an accessible interface that brings medical document processing, AI-assisted explanations, voice-based accessibility, and healthcare organization tools together in one platform.

The project combines a React-based frontend with a Python FastAPI backend. Its planned document-understanding workflow incorporates text extraction, Optical Character Recognition (OCR), and Gemma-based language processing to make medical information easier to understand.

Beyond document processing, UNMYST is designed to support prescription accessibility, medication reminders, doctor visit notes, and nearby pharmacy discovery.

**Project Name:** UNMYST  
**Team Name:** Team CIPHER  
**Domain:** Healthcare Technology and Accessibility  
**Primary Users:** Older adults and people with visual impairments  
**Application Type:** Web Application

---

## 2. Problem Statement

Understanding medical information is an essential part of managing personal healthcare. However, medical reports, prescriptions, diagnostic results, and treatment instructions often present information in formats that are difficult for many people to interpret.

Older adults may struggle with small text, unfamiliar medical terminology, and complex instructions. People with visual impairments may encounter additional barriers when medical information is available primarily in visual or document-based formats.

These challenges can contribute to misunderstandings, difficulty following healthcare instructions, missed follow-ups, and increased dependence on caregivers.

Existing digital healthcare tools may address individual needs without providing a unified, accessible experience for understanding medical documents and organizing related healthcare activities.

UNMYST aims to address these challenges through a centralized platform that makes medical information easier to access, understand, and use.

---

## 3. Our Solution

UNMYST proposes an accessibility-focused healthcare platform that helps users interact with medical information through document processing, simplified explanations, and accessible presentation.

The platform is designed around the following workflow:

1. **Document Upload:** Users upload supported medical documents through the web interface.
2. **Text Extraction:** The backend extracts text embedded in supported documents.
3. **Optical Character Recognition:** OCR processes scanned documents and image-based pages to recognize readable text.
4. **AI-Assisted Simplification:** Gemma processes extracted medical text to generate explanations in simpler language.
5. **Accessible Presentation:** The application displays the resulting information in a readable, structured format.
6. **Voice Output:** Text-to-speech functionality helps users listen to available information.
7. **Healthcare Organization:** Additional modules support medication schedules, doctor visit notes, and pharmacy discovery.

The intended outcome is a more accessible healthcare information experience that supports user understanding without replacing professional medical advice.

---

## 4. Objectives

The primary objectives of UNMYST are:

- To improve access to medical information for older adults and people with visual impairments.
- To simplify complex medical terminology through AI-assisted explanations.
- To support the processing of both text-based and scanned medical documents.
- To provide accessible presentation and spoken output.
- To help users organize medication schedules and healthcare follow-ups.
- To make doctor visit information easier to record and revisit.
- To provide convenient access to nearby pharmacy information.
- To create a modular and extensible architecture for future healthcare integrations.

---

## 5. Key Features

### 5.1 Medical Report Simplification

The Medical Report Simplifier is the central document-understanding component of UNMYST.

It is designed to accept supported medical documents, extract their contents, and present information in a more understandable format.

Potential processing capabilities include:

- PDF document upload.
- Text extraction from supported PDF and TXT files.
- OCR-based recognition for scanned documents.
- AI-assisted explanations of medical terminology.
- Structured presentation of extracted information.

The quality of the output depends on document readability, extraction accuracy, and the reliability of subsequent AI processing.

### 5.2 OCR-Based Document Processing

Some medical documents contain photographs or scanned images rather than selectable text.

OCR is intended to recognize text in these documents and make it available for subsequent processing.

The planned workflow includes:

- Identifying documents or pages with insufficient extractable text.
- Processing suitable page images using an OCR engine.
- Returning recognized text to the document-processing pipeline.
- Handling unreadable content and extraction failures.
- Preserving important measurements, units, and medical terminology wherever possible.

### 5.3 AI-Powered Medical Explanations

UNMYST plans to use Gemma for AI-assisted medical information simplification.

The intended functionality includes:

- Explaining medical terminology in simpler language.
- Presenting extracted information in a structured format.
- Helping users understand the wording used in medical reports.
- Preserving reported values and units.
- Communicating uncertainty when information is incomplete or ambiguous.

AI-generated explanations must not be treated as confirmed diagnoses or independent treatment recommendations.

### 5.4 Prescription Reader

The Prescription Reader is intended to help users access prescription information more conveniently.

Potential capabilities include recognizing readable prescription text, presenting available information clearly, and supporting spoken output.

Handwritten prescriptions can be difficult to interpret reliably. Medication names, dosages, and instructions must not be guessed when the source is unclear.

### 5.5 Voice Assistant

Voice-oriented accessibility helps users interact with information without relying entirely on visual reading.

The application includes browser-based text-to-speech functionality for supported content.

Further voice capabilities may include spoken navigation, voice input, and conversational interaction, depending on implementation.

### 5.6 Medication Reminders

The Medication Reminders module is intended to help users organize medication schedules and healthcare-related follow-ups.

Potential capabilities include:

- Recording medication schedules.
- Displaying upcoming reminders.
- Organizing medication-related information.
- Supporting notifications where an appropriate notification mechanism is implemented.

Reminder reliability depends on scheduling logic, persistence, permissions, and notification delivery.

### 5.7 Doctor Visit Notes

The Doctor Visit Notes module is intended to help users organize information associated with medical appointments.

Potential capabilities include:

- Recording appointment notes.
- Organizing doctor-provided instructions.
- Maintaining follow-up information.
- Reviewing previously recorded notes.

Persistent storage and secure record management are required for these capabilities to function as a complete record-keeping system.

### 5.8 Nearby Medical Stores

The Nearby Medical Stores module is intended to help users discover pharmacies near a selected or current location.

A complete implementation may incorporate a mapping or location service to retrieve pharmacy locations and relevant details.

Pharmacy discovery does not independently establish medicine availability, prescription validity, or the suitability of a medication.

### 5.9 Accessibility-Focused Interface

UNMYST is designed with a user experience centered on clarity and accessibility.

Design priorities include:

- Clear navigation.
- Readable typography.
- Simple page layouts.
- Accessible controls.
- Consistent visual hierarchy.
- Reduced interface complexity.
- Support for spoken information.

---

## 6. System Architecture

UNMYST follows a frontend–backend architecture that separates the user interface from document processing and AI-related operations.

### Frontend Layer

The React frontend provides the application interface, including the dashboard, navigation, document upload, and feature pages.

### API Layer

The frontend communicates with the backend through HTTP requests. API endpoints define how document uploads and other supported operations are handled.

### Backend Layer

The FastAPI backend receives requests, validates uploaded files, performs supported document-processing operations, and returns structured responses.

### Document Processing Layer

The document-processing layer extracts available PDF text. OCR integration is intended to handle scanned documents and image-based pages.

### AI Processing Layer

The planned AI layer connects extracted text to Gemma for simplified explanations.

### Presentation Layer

The frontend presents the resulting information and supports accessible output through available text-to-speech functionality.

### Architecture Flow

```text
+--------------------------------------+
|             User                     |
+------------------+-------------------+
                   |
                   v
+--------------------------------------+
|       React + Vite Frontend          |
|                                      |
| Dashboard | Upload | Accessibility   |
+------------------+-------------------+
                   |
                   v
+--------------------------------------+
|          FastAPI Backend             |
|                                      |
| Request Handling | File Validation   |
+------------------+-------------------+
                   |
                   v
+--------------------------------------+
|       Document Processing            |
|                                      |
| PDF/TXT Extraction | OCR Integration |
+------------------+-------------------+
                   |
                   v
+--------------------------------------+
|        Gemma AI Processing           |
|                                      |
| Medical Text Simplification          |
+------------------+-------------------+
                   |
                   v
+--------------------------------------+
|       Structured Response            |
+------------------+-------------------+
                   |
                   v
+--------------------------------------+
|        Accessible Frontend           |
|                                      |
| Text Display | Text-to-Speech        |
+--------------------------------------+
```

The diagram represents the intended end-to-end architecture. Components shown as integrations must be implemented and configured before the complete workflow can operate.

---

## 7. Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| React | Component-based user interface |
| Vite | Frontend development server and build tooling |
| JavaScript | Frontend application logic |
| CSS | Layout, styling, and responsive presentation |
| Lucide React | Interface icons |

### Backend

| Technology | Purpose |
|---|---|
| Python | Backend application logic |
| FastAPI | HTTP API development |
| Uvicorn | ASGI application server |
| python-multipart | Multipart file upload handling |
| pypdf | PDF text extraction |

### AI and Document Processing

| Technology | Intended purpose |
|---|---|
| OCR engine | Text recognition from scanned documents |
| Gemma | AI-assisted explanation and simplification |
| Text-to-speech | Spoken presentation of supported content |

The specific OCR engine and Gemma runtime should be documented once selected and integrated.

### Development Environment

- Node.js and npm.
- Python 3.
- Python virtual environments.
- Visual Studio Code or another suitable code editor.
- A modern web browser.

---

## 8. Project Structure

The main project directory is organized as follows:

```text
UNMYST-main/
│
├── backend/
│   ├── main.py
│   └── .venv/
│
├── public/
│   ├── favicon.svg
│   └── icons.svg
│
├── src/
│   ├── assets/
│   ├── App.jsx
│   ├── App.css
│   ├── api.ts
│   ├── index.css
│   └── main.jsx
│
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

### Directory Description

- `backend/`: Contains the Python backend application.
- `backend/main.py`: Defines the FastAPI application and current document-processing endpoints.
- `backend/.venv/`: Local Python virtual environment created during setup.
- `public/`: Contains static assets.
- `src/`: Contains the frontend application code.
- `src/App.jsx`: Defines the primary application interface and feature navigation.
- `src/api.ts`: Contains frontend API communication logic.
- `src/App.css`: Contains application-specific styling.
- `src/index.css`: Contains global styles.
- `src/main.jsx`: Frontend entry point.
- `package.json`: Defines frontend dependencies and available npm scripts.
- `package-lock.json`: Records the resolved npm dependency tree.
- `vite.config.js`: Configures Vite.

The `.venv` directory is generated locally and should not be committed as part of the source code.

---

## 9. Application Workflow

### Medical Document Workflow

1. The user opens the Medical Reports interface.
2. The user selects a supported document.
3. The frontend sends the file to the backend.
4. The backend validates the upload.
5. The document-processing logic extracts available text.
6. Documents requiring image-based text recognition are routed through the OCR component once integrated.
7. Extracted text is submitted to Gemma once AI integration is available.
8. The generated explanation is returned to the frontend.
9. The interface displays the result and provides supported accessibility options.

### Error Handling

The application should handle common problems, including:

- Unsupported file formats.
- Files exceeding the upload-size limit.
- Empty or unreadable documents.
- Scanned PDFs requiring OCR.
- Network or backend connection failures.
- AI processing failures.
- Incomplete or ambiguous extracted information.

Errors should be communicated clearly without exposing sensitive document content.

---

## 10. Installation and Setup

The following instructions describe the current local development setup on Windows.

### Prerequisites

Install:

- Node.js and npm.
- Python 3.
- pip.

Verify the installations:

```bash
node --version
npm --version
python --version
```

### Step 1: Open the Project

Open the `UNMYST-main` directory in Visual Studio Code.

Open a terminal at the project root.

### Step 2: Install Frontend Dependencies

```bash
npm install
```

### Step 3: Start the Frontend

```bash
npm run dev
```

Open the local address displayed by Vite. The default address is commonly:

```text
http://localhost:5173/
```

### Step 4: Open a Separate Backend Terminal

Navigate to the backend directory:

```bash
cd backend
```

### Step 5: Create a Python Virtual Environment

```bash
python -m venv .venv
```

### Step 6: Activate the Virtual Environment

On Windows Command Prompt:

```bat
.venv\Scripts\activate.bat
```

On PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

### Step 7: Install Backend Dependencies

```bash
python -m pip install fastapi uvicorn python-multipart pypdf
```

### Step 8: Start the Backend Server

From the `backend` directory:

```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The backend should now be available at:

```text
http://127.0.0.1:8000
```

### Step 9: Verify the Backend

Open the following endpoints in a browser:

**Root endpoint**

```text
http://127.0.0.1:8000/
```

**Health endpoint**

```text
http://127.0.0.1:8000/api/health
```

**Interactive API documentation**

```text
http://127.0.0.1:8000/docs
```

A successful response from the health endpoint confirms that the backend is responding. It does not establish that every application feature is operational.

### Step 10: Run the Application

Keep both terminals running:

- Frontend: Vite development server.
- Backend: FastAPI application served by Uvicorn.

Open the frontend in the browser and test the available functionality.

**Dependency management:** The current backend directory does not include a `requirements.txt` file. The installation command above reflects the dependencies installed during local setup. A version-pinned dependency file should be maintained for reproducible installation.

---

## 11. Backend API

The current backend exposes the following endpoints.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Root endpoint |
| GET | `/api/health` | Health check |
| POST | `/api/documents/extract` | Upload a supported document and extract available text |

### Document Extraction Endpoint

**Endpoint:**

```http
POST /api/documents/extract
```

The endpoint accepts a supported PDF or TXT file using a multipart form upload.

The current implementation includes:

- File upload handling.
- File-size validation.
- PDF text extraction using pypdf.
- Text-file reading.
- A response indicating when OCR is needed.
- A limit on the amount of extracted text returned.

### Example Response

The following is an illustrative response structure; actual fields and values depend on the implementation and uploaded document.

```json
{
  "filename": "sample-report.pdf",
  "status": "text_extracted",
  "message": "Document text extracted successfully.",
  "extracted_text": "Example extracted document text..."
}
```

The endpoint currently extracts document text. It does not, by itself, generate AI-powered medical explanations.

---

## 12. AI and Document Processing

### Text Extraction

The existing backend uses pypdf to retrieve text embedded in supported PDF files.

This works when the PDF contains readable text. It may not retrieve the actual document contents when pages consist primarily of scanned images.

### Optical Character Recognition

OCR is intended to recognize text from image-based documents.

The planned processing sequence is:

1. Identify pages with insufficient extractable text.
2. Convert suitable pages into images if required.
3. Pass the images to the selected OCR engine.
4. Collect recognized text.
5. Validate the extracted result.
6. Forward usable content to the AI-processing layer.

### Gemma Integration

Gemma is intended to generate simplified explanations from extracted medical text.

The integration should preserve the source document's values and units, avoid unsupported medical conclusions, and identify information that requires professional interpretation.

The specific model, inference runtime, and deployment configuration must be documented after integration.

---

## 13. Accessibility and User Experience

Accessibility is a central design objective of UNMYST.

The platform aims to provide:

- Readable content and clear visual hierarchy.
- Simple navigation.
- Consistent interface controls.
- Spoken output through text-to-speech.
- Reduced dependence on dense medical terminology.
- Support for older adults and people with visual impairments.

Further accessibility validation should cover keyboard navigation, screen-reader compatibility, text scaling, contrast, focus visibility, and clear error messages.

Accessibility features should be tested with representative users and assistive technologies wherever possible.

---

## 14. Privacy and Security

Medical information requires careful handling.

The platform should follow privacy-conscious development practices, including:

- Validating uploaded file types and sizes.
- Avoiding unnecessary retention of medical documents.
- Preventing sensitive document contents from appearing in application logs.
- Protecting API requests and any stored records.
- Keeping credentials and API keys out of source code.
- Evaluating data handling when using hosted AI services.
- Limiting access to personal information.
- Communicating how documents are processed and retained.

The development version should use fictional or non-sensitive sample documents for testing.

Production deployment requires additional security, privacy, and operational review.

---

## 15. Current Implementation

The current development version provides the foundation for the UNMYST application.

### Implemented in the Current Codebase

- React and Vite frontend.
- Application dashboard and navigation.
- FastAPI backend.
- Health-check endpoint.
- Document upload endpoint.
- PDF and TXT text extraction.
- Upload-size validation.
- Browser-based text-to-speech functionality.

### Remaining Integration Work

- OCR processing for scanned medical documents.
- Gemma-based medical text simplification.
- End-to-end integration of extracted text and AI-generated explanations.
- Prescription information processing.
- Persistent medication reminders.
- Doctor visit note storage and management.
- Pharmacy discovery integration.
- Additional accessibility and security validation.

This distinction is important: the application interface and backend foundation are present, while the complete AI-assisted healthcare workflow requires additional implementation and testing.

---

## 16. Future Scope

UNMYST can be extended in several directions.

### Advanced Document Understanding

- Improved OCR accuracy for scanned medical reports.
- Support for additional document formats.
- Better handling of tables, laboratory values, and structured medical records.
- Validation of extracted content against the original document.

### AI-Assisted Explanations

- Gemma integration with structured output.
- Multilingual medical explanations.
- Context-aware explanations with clear uncertainty.
- Improved safeguards against altered values and unsupported interpretations.

### Enhanced Accessibility

- Additional language support.
- Expanded voice interactions.
- Screen-reader and keyboard-navigation improvements.
- Adjustable text sizes and display preferences.
- More comprehensive accessibility testing.

### Healthcare Organization

- Persistent medication schedules.
- Reliable reminder notifications.
- Doctor visit note management.
- Follow-up task organization.
- Secure storage where required.

### Healthcare Ecosystem Integration

- Pharmacy discovery through appropriate location services.
- Integration with authorized healthcare systems where feasible.
- Secure exchange of relevant medical information.
- Additional user and caregiver support features.

---

## 17. Responsible Use

UNMYST is intended to improve access to healthcare information, not to replace healthcare professionals.

AI-generated explanations may contain errors or omit important context. Users should consult qualified healthcare professionals when interpreting medical results or making decisions about diagnoses, medication, and treatment.

The platform should preserve the original medical information alongside any generated explanation so that users and healthcare professionals can refer to the source.

---

## 18. Team

### Team CIPHER

**Project:** UNMYST — Accessible Healthcare Information Platform

Team CIPHER is developing UNMYST with the goal of making healthcare information easier to access and understand for older adults and people with visual impairments.

The project brings together frontend development, backend services, document processing, AI-assisted information simplification, and accessibility-focused design.

**Our goal:** Make medical information easier to understand, easier to access, and easier to use.

---

*UNMYST — Building a more accessible healthcare experience.*