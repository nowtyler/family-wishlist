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
            
            # Create SMTP session with timeout
            context = ssl.create_default_context()
            
            # For port 465, use SMTP_SSL
            if self.settings.smtp_port == 465:
                server = smtplib.SMTP_SSL(
                    self.settings.smtp_server, 
                    self.settings.smtp_port,
                    context=context,
                    timeout=30  # 30 second timeout
                )
            else:
                # For other ports (587, 25, etc)
                server = smtplib.SMTP(
                    self.settings.smtp_server, 
                    self.settings.smtp_port,
                    timeout=30  # 30 second timeout
                )
                if self.settings.use_tls:
                    server.starttls(context=context)
            
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
            "name": "welcome_user",
            "subject": "Welcome to Family Wishlist!",
            "body": """
            <html>
            <body>
                <h2>Welcome to Family Wishlist, {user_name}!</h2>
                
                <p>Thank you for joining Family Wishlist. We're excited to have you on board! Here's everything you need to know to get started:</p>
                
                <h3>Quick Start Guide:</h3>
                <ul>
                    <li>Access your wishlist anytime at: <a href="https://wishlist.ariahive.top">wishlist.ariahive.top</a></li>
                    <li>Create your wishlist by adding items you'd love to receive</li>
                    <li>Join or create a household to share wishlists with family members</li>
                    <li>View others' wishlists and mark items as purchased</li>
                    <li>Set your birthday and preferences in your profile</li>
                </ul>

                <h3>Key Features:</h3>
                <ul>
                    <li>Add items from any website or create custom items</li>
                    <li>Set priority levels for your wishlist items</li>
                    <li>Get notified of upcoming birthdays and events</li>
                    <li>Keep gift purchases a surprise with our privacy features</li>
                </ul>

                <p>Your account details:</p>
                <ul>
                    <li>Username: {username}</li>
                    <li>Email: {email}</li>
                </ul>

                <p>Need help? Click the help icon (?) in the top navigation bar for detailed instructions and tips.</p>

                <p>We hope you enjoy using Family Wishlist to make gift-giving more meaningful and organized!</p>

                <p>Best regards,<br>
                The Family Wishlist Team</p>
            </body>
            </html>
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