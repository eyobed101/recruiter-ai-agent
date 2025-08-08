from celery import Celery
import os
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from pprint import pprint

# Celery broker
celery = Celery('tasks', broker='redis://localhost:6379/0')

# Configure Brevo API key
configuration = sib_api_v3_sdk.Configuration()
configuration.api_key['api-key'] = os.getenv("BREVO_API_KEY")  # Set in your env vars

@celery.task
def send_status_email(email: str, status: str, job_title: str):
    """
    Sends an application status update email via Brevo
    """
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
        sib_api_v3_sdk.ApiClient(configuration)
    )

    # Create the email
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": email}],
        sender={"name": "Recruiter", "email": "eyolindeep@gmail.com"},
        subject=f"Application Update: {job_title}",
        html_content=f"<p>Your application for <strong>{job_title}</strong> is now <b>{status}</b>.</p>"
    )

    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        pprint(api_response)
    except ApiException as e:
        print(f"Exception when sending email: {e}")
