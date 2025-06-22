# backend/app/services/email_service.py
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import logging
from datetime import datetime
import secrets
import string

from ..models import EmailSettings, EmailTemplate, EmailLog, FamilyMember
from .. import crud
from ..utils.timezone_utils import get_est_timestamp_strftime

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = None
        self._load_settings()
    
    def _load_settings(self):
        """Load email settings from database"""
        try:
            self.settings = self.db.query(EmailSettings).filter(EmailSettings.is_active == True).first()
        except Exception as e:
            logger.error(f"Failed to load email settings: {e}")
            self.settings = None
    
    def _get_template(self, template_name: str) -> Optional[EmailTemplate]:
        """Get email template by name"""
        try:
            return self.db.query(EmailTemplate).filter(
                EmailTemplate.name == template_name,
                EmailTemplate.is_active == True
            ).first()
        except Exception as e:
            logger.error(f"Failed to get email template {template_name}: {e}")
            return None
    
    def _create_email_log(self, recipient_email: str, recipient_name: str, 
                         subject: str, body: str, template_name: str, 
                         status: str, error_message: str = None) -> EmailLog:
        """Create email log entry"""
        try:
            email_log = EmailLog(
                recipient_email=recipient_email,
                recipient_name=recipient_name,
                subject=subject,
                body=body,
                template_name=template_name,
                status=status,
                error_message=error_message
            )
            self.db.add(email_log)
            self.db.commit()
            return email_log
        except Exception as e:
            logger.error(f"Failed to create email log: {e}")
            self.db.rollback()
            return None
    
    def _send_email(self, to_email: str, subject: str, body: str, 
                   recipient_name: str = None) -> bool:
        """Send email using SMTP"""
        if not self.settings:
            logger.error("No active email settings found")
            return False
        
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = f"{self.settings.from_name} <{self.settings.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Add body
            msg.attach(MIMEText(body, 'html'))
            
            # Create SMTP session
            if self.settings.use_ssl:
                server = smtplib.SMTP_SSL(self.settings.smtp_server, self.settings.smtp_port)
            else:
                server = smtplib.SMTP(self.settings.smtp_server, self.settings.smtp_port)
                if self.settings.use_tls:
                    server.starttls()
            
            # Login
            server.login(self.settings.smtp_username, self.settings.smtp_password)
            
            # Send email
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
    
    def send_template_email(self, template_name: str, recipient_email: str, 
                           recipient_name: str = None, 
                           template_vars: Dict[str, Any] = None) -> EmailLog:
        """Send email using a template"""
        template = self._get_template(template_name)
        if not template:
            error_msg = f"Template {template_name} not found or inactive"
            logger.error(error_msg)
            return self._create_email_log(
                recipient_email, recipient_name, 
                f"Error: {template_name}", "", template_name, 
                "failed", error_msg
            )
        
        # Replace template variables
        subject = template.subject
        body = template.body
        
        if template_vars:
            for key, value in template_vars.items():
                placeholder = f"{{{{{key}}}}}"
                subject = subject.replace(placeholder, str(value))
                body = body.replace(placeholder, str(value))
        
        # Send email
        success = self._send_email(recipient_email, subject, body, recipient_name)
        
        # Log the email
        return self._create_email_log(
            recipient_email, recipient_name, subject, body, template_name,
            "sent" if success else "failed"
        )
    
    def send_password_reset_email(self, user: FamilyMember, reset_url: str) -> EmailLog:
        """Send password reset email"""
        template_vars = {
            "user_name": user.name,
            "username": user.username,
            "reset_url": reset_url,
            "expires_in": "24 hours"
        }
        
        return self.send_template_email(
            "password_reset", 
            user.email, 
            user.name, 
            template_vars
        )
    
    def send_welcome_email(self, user: FamilyMember) -> EmailLog:
        """Send welcome email to new user"""
        template_vars = {
            "user_name": user.name,
            "username": user.username,
            "email": user.email
        }
        
        return self.send_template_email(
            "welcome_user", 
            user.email, 
            user.name, 
            template_vars
        )
    
    def send_password_changed_email(self, user: FamilyMember) -> EmailLog:
        """Send notification when password is changed by admin"""
        template_vars = {
            "user_name": user.name,
            "username": user.username
        }
        
        return self.send_template_email(
            "password_changed", 
            user.email, 
            user.name, 
            template_vars
        )
    
    def send_household_request_email(self, user: FamilyMember, household_name: str) -> EmailLog:
        """Send notification when user requests to join household"""
        template_vars = {
            "user_name": user.name,
            "username": user.username,
            "household_name": household_name
        }
        
        return self.send_template_email(
            "household_request", 
            user.email, 
            user.name, 
            template_vars
        )
    
    def send_household_response_email(self, user: FamilyMember, household_name: str, 
                                    approved: bool) -> EmailLog:
        """Send notification when household request is approved/declined"""
        template_vars = {
            "user_name": user.name,
            "username": user.username,
            "household_name": household_name,
            "status": "approved" if approved else "declined"
        }
        
        template_name = "household_approved" if approved else "household_declined"
        return self.send_template_email(
            template_name, 
            user.email, 
            user.name, 
            template_vars
        )
    
    def test_email_settings(self, test_email: str) -> EmailLog:
        """Test email settings by sending a test email"""
        subject = "Family Wishlist - Email Test"
        body = """
        <html>
        <body>
            <h2>Email Test Successful</h2>
            <p>This is a test email from your Family Wishlist application.</p>
            <p>If you received this email, your SMTP settings are working correctly.</p>
            <p>Sent at: {timestamp}</p>
        </body>
        </html>
        """.format(timestamp=get_est_timestamp_strftime("%Y-%m-%d %H:%M:%S"))
        
        success = self._send_email(test_email, subject, body, "Test User")
        
        return self._create_email_log(
            test_email, "Test User", subject, body, "test_email",
            "sent" if success else "failed"
        )

def generate_reset_token() -> str:
    """Generate a secure reset token"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))

def create_default_templates(db: Session):
    """Create default email templates if they don't exist."""
    default_templates = [
        {
            "name": "password_reset",
            "subject": "Password Reset Request",
            "body": """
            Hello {name},

            You have requested to reset your password. Please click the link below to reset your password:

            {reset_url}

            If you did not request this password reset, please ignore this email.

            Best regards,
            Family Wishlist Team
            """
        },
        {
            "name": "welcome",
            "subject": "Welcome to Family Wishlist",
            "body": """
            Welcome {name}!

            Thank you for joining Family Wishlist. We're excited to have you on board.

            You can now start creating your wishlist and sharing it with your family members.

            Best regards,
            Family Wishlist Team
            """
        },
        {
            "name": "password_changed",
            "subject": "Password Changed",
            "body": """
            Hello {name},

            Your password has been successfully changed.

            If you did not make this change, please contact the administrator immediately.

            Best regards,
            Family Wishlist Team
            """
        },
        {
            "name": "household_request",
            "subject": "New Household Request",
            "body": """
            Hello {name},

            You have been invited to join the household: {household_name}

            Please log in to accept or decline this invitation.

            Best regards,
            Family Wishlist Team
            """
        },
        {
            "name": "household_response",
            "subject": "Household Request {status}",
            "body": """
            Hello {name},

            Your request to join the household {household_name} has been {status}.

            Best regards,
            Family Wishlist Team
            """
        },
        {
            "name": "test_email",
            "subject": "Test Email",
            "body": """
            Hello,

            This is a test email to verify your email settings.

            If you received this email, your email settings are configured correctly.

            Best regards,
            Family Wishlist Team
            """
        }
    ]

    for template in default_templates:
        existing = db.query(EmailTemplate).filter_by(name=template["name"]).first()
        if not existing:
            new_template = EmailTemplate(
                name=template["name"],
                subject=template["subject"],
                body=template["body"].strip(),
                is_active=True
            )
            db.add(new_template)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create default templates: {e}")
        raise 