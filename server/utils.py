import os
import magic
from typing import Optional
from fastapi import UploadFile, HTTPException
from config import settings
from pathlib import Path
import shutil
import PyPDF2
from docx import Document
import logging
import aiofiles
import aiofiles.os

logger = logging.getLogger(__name__)

async def save_uploaded_file(file: UploadFile, custom_filename: Optional[str] = None) -> str:

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
        
        # Generate secure filename
        ext = "pdf" if "pdf" in file_type else "docx"
        filename = f"{custom_filename or Path(file.filename).stem}.{ext}"
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
    try:
        if file_path.endswith('.pdf'):
            async with aiofiles.open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(await f.read())
                text = "\n".join([page.extract_text() for page in reader.pages])
        elif file_path.endswith('.docx'):
            doc = Document(file_path)
            text = "\n".join([para.text for para in doc.paragraphs])
        else:
            raise ValueError("Unsupported file format")
        
        return text.strip()
    
    except Exception as e:
        logger.error(f"Text extraction failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Failed to extract text from file"
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