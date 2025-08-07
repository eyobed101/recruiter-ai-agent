from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from celery import Celery
import os

celery = Celery('tasks', broker='redis://localhost:6379/0')

@celery.task
def send_status_email(email: str, status: str, job_title: str):
    sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
    message = Mail(
        from_email="recruiter@yourdomain.com",
        to_emails=email,
        subject=f"Application Update: {job_title}",
        html_content=f"Your application is now <b>{status}</b>."
    )
    sg.send(message)