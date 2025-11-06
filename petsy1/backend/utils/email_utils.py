# utils/email_utils.py
from flask_mail import Message
from flask import current_app

def send_otp_email(recipient_email, otp):
    """Send a 6-digit OTP email using Flask-Mail."""
    mail = current_app.mail  # use the Mail instance from main app
    try:
        msg = Message("Your PETSY Login OTP", recipients=[recipient_email])
        msg.body = (
            f"Hello! Your PETSY login verification code is: {otp}\n\n"
            "This code will expire in 5 minutes."
        )
        mail.send(msg)
        print(f"✅ OTP sent to {recipient_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send OTP: {e}")
        return False
