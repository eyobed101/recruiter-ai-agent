from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
from auth import get_current_user
from models import *
from ai import analyze_resume
from tasks import send_status_email
from sqlmodel import Session, create_engine, select
from config import settings
from utils import save_uploaded_file, extract_text_from_file
import os
from typing import List, AsyncIterator
from datetime import datetime
import logging
from redis import asyncio as aioredis


logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup
    logger.info("Initializing application...")
    try:
        redis = await aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
        await FastAPILimiter.init(redis)
        logger.info("Rate limiter initialized")
        
        # Verify essential services
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("Gemini API key not configured")
        if not settings.SENDGRID_API_KEY:
            logger.warning("SendGrid API key not configured - email functions will fail")
        
        logger.info("Application startup complete")
    except Exception as e:
        logger.error(f"Startup failed: {str(e)}")
        raise
    
    yield 
    
    # Shutdown
    logger.info("Shutting down application...")
    try:
        await FastAPILimiter.close()
        logger.info("Rate limiter closed")
    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}")

app = FastAPI(
    title="AI Recruiter Assistant API",
    description="Automated technical recruitment backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Database Setup
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800
)

# API Routes
@app.get(
    "/careers/categories",
    response_model=List[CareerCategory],
    summary="Get all career categories",
    dependencies=[Depends(RateLimiter(times=10, seconds=60))]
)
async def get_career_categories():
    try:
        with Session(engine) as session:
            categories = session.exec(select(CareerCategory)).all()
            logger.info(f"Retrieved {len(categories)} career categories")
            return categories
    except Exception as e:
        logger.error(f"Error fetching career categories: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve career categories"
        )
    
# Career Category Routes
@app.post(
    "/careers/categories",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter(times=2, seconds=60))],
    summary="Create new career category",
    response_description="The created career category"
)
async def create_career_category(
    name: str,
    user: dict = Depends(get_current_user)
):
    try:
        with Session(engine) as session:
            # Check if category already exists
            existing = session.exec(select(CareerCategory).where(CareerCategory.name == name)).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Category with this name already exists"
                )
                
            category = CareerCategory(name=name)
            session.add(category)
            session.commit()
            session.refresh(category)
            
            logger.info(f"New career category created: {category.id} - {category.name}")
            
            return {
                "message": "Career category created successfully",
                "data": {
                    "id": category.id,
                    "name": category.name
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating career category: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create career category"
        )
    
    
@app.get(
    "/careers",
    response_model=List[CareerPost],
    summary="Get all career posts",
    dependencies=[Depends(RateLimiter(times=10, seconds=60))]
)
async def get_career_posts(
    category_id: Optional[int] = None,
    limit: int = 10,
    offset: int = 0
):
    try:
        with Session(engine) as session:
            query = select(CareerPost).order_by(CareerPost.posted_at.desc())
            
            if category_id:
                query = query.where(CareerPost.category_id == category_id)
                
            query = query.limit(limit).offset(offset)
            
            careers = session.exec(query).all()
            logger.info(f"Retrieved {len(careers)} career posts")
            return careers
    except Exception as e:
        logger.error(f"Error fetching career posts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve career posts"
        )
    
@app.get(
    "/careers/{career_id}",
    response_model=CareerPost,
    summary="Get career post by ID",
    dependencies=[Depends(RateLimiter(times=10, seconds=60))]
)
async def get_career_post(
    career_id: int,
    user: dict = Depends(get_current_user)
):
    try:
        with Session(engine) as session:
            career = session.exec(
                select(CareerPost).where(CareerPost.id == career_id)
            ).first()
            
            if not career:
                logger.warning(f"Career post not found: {career_id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Career post not found"
                )
                
            logger.info(f"Retrieved career post: {career_id}")
            return career
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching career post: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve career post"
        )
    

@app.post(
    "/careers",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RateLimiter(times=2, seconds=60))],
    summary="Create new job posting",
    response_description="The created career post"
)
async def create_career_post(
    title: str,
    description: str,
    requirements: str,
    user: dict = Depends(get_current_user)
):
    try:
        with Session(engine) as session:
            career = CareerPost(
                title=title,
                description=description,
                requirements=requirements,
                posted_at=datetime.utcnow()
            )
            session.add(career)
            session.commit()
            session.refresh(career)
            
            logger.info(f"New career post created: {career.id} - {career.title}")
            
            return {
                "message": "Career post created successfully",
                "data": {
                    "id": career.id,
                    "title": career.title,
                    "posted_at": career.posted_at.isoformat()
                }
            }
    except Exception as e:
        logger.error(f"Error creating career post: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create career post"
        )
    
@app.put(
    "/careers/{career_id}",
    response_model=CareerPost,
    summary="Update career post",
    dependencies=[Depends(RateLimiter(times=2, seconds=60))]
)
async def update_career_post(
    career_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    requirements: Optional[str] = None,
    location: Optional[str] = None,
    content: Optional[str] = None,
    category_id: Optional[int] = None,
    user: dict = Depends(get_current_user)
):
    try:
        with Session(engine) as session:
            career = session.exec(
                select(CareerPost).where(CareerPost.id == career_id)
            ).first()
            
            if not career:
                logger.warning(f"Career post not found: {career_id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Career post not found"
                )
                
            # Update fields if provided
            if title is not None:
                career.title = title
            if description is not None:
                career.description = description
            if requirements is not None:
                career.requirements = requirements
            if location is not None:
                career.location = location
            if content is not None:
                career.content = content
            if category_id is not None:
                career.category_id = category_id
                
            session.add(career)
            session.commit()
            session.refresh(career)
            
            logger.info(f"Updated career post: {career_id}")
            return career
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating career post: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update career post"
        )

@app.post(
    "/apply",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(RateLimiter(times=3, seconds=60))],
    summary="Submit job application",
    response_description="Application submission result"
)
async def apply_for_job(
    career_id: int,
    full_name: str,
    phone_number: str,
    email: str,
    cv: UploadFile,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)  
):
    try:
        # Validate file type
        if not cv.filename.lower().endswith(tuple(f'.{ext}' for ext in settings.ALLOWED_FILE_TYPES)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only {', '.join(settings.ALLOWED_FILE_TYPES)} files are allowed"
            )

        # Save uploaded file
        cv_path = save_uploaded_file(cv)
        logger.info(f"Saved CV to: {cv_path}")
        
        with Session(engine) as session:
            # Verify career exists
            job = session.exec(select(CareerPost).where(CareerPost.id == career_id)).first()
            if not job:
                logger.warning(f"Career post not found: {career_id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Job posting not found"
                )

            # Extract text from resume
            resume_text = extract_text_from_file(cv_path)
            logger.debug(f"Extracted resume text (length: {len(resume_text)})")
            
            # Create application record
            application = Application(
                full_name=full_name,
                phone_number=phone_number,
                email=email,
                cv_path=cv_path,
                career_id=career_id,
                user_id=user['uid'],
                status=ApplicationStatus.pending
            )
            session.add(application)
            session.commit()
            session.refresh(application)
            logger.info(f"New application created: {application.id}")

            # AI Screening in background
            background_tasks.add_task(
                process_application_screening,
                application.id,
                job.description,
                resume_text,
                job.title
            )

            return {
                "message": "Application submitted for screening",
                "application_id": application.id
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing application: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process application"
        )

@app.get(
    "/applications",
    response_model=List[Application],
    summary="Get user's applications",
    dependencies=[Depends(RateLimiter(times=10, seconds=60))]
)
async def get_applications(user: dict = Depends(get_current_user)):
    try:
        with Session(engine) as session:
            apps = session.exec(
                select(Application)
                .where(Application.user_id == user['uid'])
                .order_by(Application.created_at.desc())
            ).all()
            logger.info(f"Retrieved {len(apps)} applications for user {user['uid']}")
            return apps
    except Exception as e:
        logger.error(f"Error fetching applications: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve applications"
        )

async def process_application_screening(
    application_id: int,
    job_desc: str,
    resume_text: str,
    job_title: str
):
    with Session(engine) as session:
        try:
            application = session.exec(
                select(Application)
                .where(Application.id == application_id)
            ).first()
            
            if not application:
                logger.warning(f"Application not found for screening: {application_id}")
                return

            logger.info(f"Processing screening for application {application_id}")
            
            # AI Analysis
            ai_analysis = analyze_resume(job_desc, resume_text)
            logger.debug(f"AI analysis result: {ai_analysis}")
            
            # Update application based on score
            if ai_analysis.get("match_score", 0) < 50:
                application.status = ApplicationStatus.rejected
                logger.info(f"Application {application_id} rejected (low score)")
            else:
                application.status = ApplicationStatus.viewed
                logger.info(f"Application {application_id} marked as viewed")
            
            application.updated_at = datetime.utcnow()
            session.add(application)
            session.commit()
            
            # Send status email
            if settings.SENDGRID_API_KEY:
                send_status_email.delay(
                    application.email,
                    application.status.value,
                    job_title
                )
                logger.info(f"Status email queued for {application.email}")
            
        except Exception as e:
            logger.error(f"Error in background screening: {str(e)}")