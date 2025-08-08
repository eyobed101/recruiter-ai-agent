import os
import magic
import uuid
from typing import Optional
from fastapi import UploadFile, HTTPException
from conf.config import settings
from pathlib import Path
import logging
import aiofiles
import aiofiles.os
import PyPDF2
import io
from docx import Document

logger = logging.getLogger(__name__)

async def save_uploaded_file(file: UploadFile, custom_filename: Optional[str] = None) -> str:
    """Save uploaded file with UUID filename and return its path string"""
    try:
        # Create upload directory if needed
        await aiofiles.os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        
        # Validate file type
        file_type = magic.from_buffer(await file.read(1024), mime=True)
        await file.seek(0)
        
        if not any(file_type.endswith(ft) for ft in [
            "pdf", 
            "vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {settings.ALLOWED_FILE_TYPES}"
            )
        
        # Generate UUID filename with original extension
        ext = Path(file.filename).suffix.lower() or (".pdf" if "pdf" in file_type else ".docx")
        filename = f"{uuid.uuid4()}{ext}"
        file_path = str(Path(settings.UPLOAD_DIR) / filename)
        
        # Save file async
        async with aiofiles.open(file_path, "wb") as buffer:
            while chunk := await file.read(8192):  # 8KB chunks
                await buffer.write(chunk)
        
        # Verify file size
        file_size = (await aiofiles.os.stat(file_path)).st_size
        if file_size > settings.MAX_FILE_SIZE:
            await aiofiles.os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {settings.MAX_FILE_SIZE} bytes"
            )
        
        logger.debug(f"File saved successfully: {file_path}")
        return file_path
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File save error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save uploaded file"
        )
    
async def extract_text_from_file(file_path: str) -> str:
    """Extract text from PDF or DOCX files with proper file handling"""
    try:
        if not await aiofiles.os.path.exists(file_path):
            raise ValueError("File does not exist")
        
        if file_path.endswith('.pdf'):
            # Read PDF using file path directly
            async with aiofiles.open(file_path, 'rb') as f:
                pdf_content = await f.read()
                reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
                text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
                
        elif file_path.endswith('.docx'):
            # Read DOCX using file path
            doc = Document(file_path)
            text = "\n".join([para.text for para in doc.paragraphs if para.text])
        else:
            raise ValueError("Unsupported file format")
        
        if not text.strip():
            raise ValueError("No text content found in file")
        
        return text.strip()
    
    except PyPDF2.PdfReadError as e:
        logger.error(f"PDF reading error: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Invalid PDF file format"
        )
    except Exception as e:
        logger.error(f"Text extraction failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Failed to extract text from file. Please ensure the file is not password protected and contains readable text."
        )

async def cleanup_file(file_path: str) -> None:
    try:
        if await aiofiles.os.path.exists(file_path):
            await aiofiles.os.remove(file_path)
            logger.debug(f"Cleaned up file: {file_path}")
    except Exception as e:
        logger.warning(f"File cleanup failed: {str(e)}")

def validate_email(email: str) -> bool:
    return (
        "@" in email and 
        "." in email.split("@")[-1] and 
        len(email.split("@")[0]) > 0 and
        len(email.split("@")[-1].split(".")[0]) > 0
        )