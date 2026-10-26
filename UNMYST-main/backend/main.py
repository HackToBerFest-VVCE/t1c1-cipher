from io import BytesIO

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader

app = FastAPI(title="UNMYST API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"app": "UNMYST", "message": "Backend is running!"}


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "UNMYST API"}


@app.post("/api/documents/extract")
async def extract_document(file: UploadFile = File(...)):
    filename = file.filename or "uploaded_file"

    if not filename.lower().endswith((".pdf", ".txt")):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF or TXT file.",
        )

    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="The file is empty.")

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Maximum file size is 10 MB.",
        )

    try:
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(BytesIO(content))

            if reader.is_encrypted:
                raise HTTPException(
                    status_code=400,
                    detail="The PDF is password-protected.",
                )

            extracted_text = "\n".join(
                page.extract_text() or "" for page in reader.pages
            )
        else:
            extracted_text = content.decode("utf-8", errors="replace")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Could not read the document.",
        ) from exc

    if not extracted_text.strip():
        return {
            "filename": filename,
            "status": "needs_ocr",
            "message": "No selectable text found. OCR is needed.",
            "extracted_text": "",
            "character_count": 0,
        }

    return {
        "filename": filename,
        "status": "text_extracted",
        "message": "Document text extracted successfully.",
        "extracted_text": extracted_text[:50000],
        "character_count": len(extracted_text),
    }