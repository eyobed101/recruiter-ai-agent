import google.generativeai as genai # type: ignore
from dotenv import load_dotenv
import os

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def analyze_resume(job_desc: str, resume_text: str) -> dict:
    model = genai.GenerativeModel('gemini-pro')
    prompt = f"""
    Analyze this resume for a {job_desc} role:
    {resume_text}

    Return JSON with:
    - match_score (0-100)
    - strengths (list)
    - weaknesses (list)
    - suggested_questions (for interview)
    """
    response = model.generate_content(prompt)
    return response.text