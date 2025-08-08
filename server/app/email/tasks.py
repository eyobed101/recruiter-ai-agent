# app/email/tasks.py
from datetime import datetime
from fastapi import logger
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from celery import Celery
from jinja2 import Template
import os
from typing import Literal

celery = Celery('email_tasks', broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'))

# Email template (could also be loaded from a file)
STATUS_EMAIL_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { max-width: 600px; margin: 20px auto; font-family: Arial, sans-serif; }
        .header { background-color: #1a82e2; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .status { font-weight: bold; color: {% if status == 'accepted' %}#4CAF50{% elif status == 'rejected' %}#F44336{% else %}#FFC107{% endif %}; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Application Status Update</h2>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Your application for <strong>{{ job_title }}</strong> has been updated to: 
            <span class="status">{{ status|upper }}</span>.</p>
            
            {% if status == 'accepted' %}
            <p>Congratulations! Our team will contact you shortly to discuss next steps.</p>
            {% elif status == 'rejected' %}
            <p>We appreciate your interest and encourage you to apply for future opportunities.</p>
            {% else %}
            <p>We're currently reviewing your application and will update you as we progress.</p>
            {% endif %}
        </div>
        <div class="footer">
            <p>© {{ year }} Your Company Name. All rights reserved.</p>
            <p><a href="{{ unsubscribe_url }}">Unsubscribe</a> from these notifications</p>
        </div>
    </div>
</body>
</html>
"""

@celery.task(bind=True, max_retries=3)
def send_status_email(
    self,
    email: str,
    status: Literal["pending", "viewed", "accepted", "rejected"],
    job_title: str,
    unsubscribe_url: str = "https://yourdomain.com/unsubscribe"
):
    """Send application status email via SendGrid"""
    try:
        # Render the template
        template = Template(STATUS_EMAIL_TEMPLATE)
        html_content = template.render(
            status=status,
            job_title=job_title,
            year=datetime.now().year,
            unsubscribe_url=unsubscribe_url
        )

        # Prepare email
        message = Mail(
            from_email=("recruitment@yourdomain.com", "Your Company Recruitment"),
            to_emails=email,
            subject=f"Application Update: {job_title}",
            html_content=html_content
        )

        # Send email
        sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
        response = sg.send(message)

        # Log successful send (status code 2xx means success)
        if 200 <= response.status_code < 300:
            logger.info(f"Status email sent to {email} for job {job_title}")
        else:
            logger.error(f"SendGrid API error: {response.status_code} - {response.body}")
            raise Exception(f"SendGrid API error: {response.status_code}")

    except Exception as e:
        logger.error(f"Failed to send status email to {email}: {str(e)}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))