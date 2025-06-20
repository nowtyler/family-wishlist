# backend/app/services/email_service.py
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import logging
from datetime import datetime
import secrets
import string

from ..models import EmailSettings, EmailTemplate, EmailLog, FamilyMember
from .. import crud

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
        """.format(timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        
        success = self._send_email(test_email, subject, body, "Test User")
        
        return self._create_email_log(
            test_email, "Test User", subject, body, "test_email",
            "sent" if success else "failed"
        )

def generate_reset_token() -> str:
    """Generate a secure reset token"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))

def create_default_templates(db: Session):
    """Create default email templates if they don't exist"""
    templates = [
        {
            "name": "password_reset",
            "subject": "Family Wishlist - Password Reset Request",
            "body": """
            <html>
            <body>
                <h2>Password Reset Request</h2>
                <p>Hello {user_name},</p>
                <p>You have requested a password reset for your Family Wishlist account.</p>
                <p>Username: {username}</p>
                <p>Click the link below to reset your password:</p>
                <p><a href="{reset_url}">Reset Password</a></p>
                <p>This link will expire in {expires_in}.</p>
                <p>If you didn't request this reset, please ignore this email.</p>
                <p>Best regards,<br>Family Wishlist Team</p>
            </body>
            </html>
            """
        },
        {
            "name": "welcome_user",
            "subject": "Welcome to Family Wishlist",
            "body": """
            <html>
            <body>
                <h2>Welcome to Family Wishlist!</h2>
                <p>Hello {user_name},</p>
                <p>Welcome to your Family Wishlist account!</p>
                <p>Your account details:</p>
                <ul>
                    <li>Username: {username}</li>
                    <li>Email: {email}</li>
                </ul>
                <p>You can now:</p>
                <ul>
                    <li>Create and manage your wishlist</li>
                    <li>View other family members' wishlists (if in same household)</li>
                    <li>Mark items as interested or purchased</li>
                    <li>Add comments to wishlist items</li>
                </ul>
                <p>If you have any questions, please contact your family admin.</p>
                <p>Best regards,<br>Family Wishlist Team</p>
            </body>
            </html>
            """
        },
        {
            "name": "password_changed",
            "subject": "Family Wishlist - Password Changed",
            "body": """
            <html>
            <body>
                <h2>Password Changed</h2>
                <p>Hello {user_name},</p>
                <p>Your Family Wishlist password has been changed by an administrator.</p>
                <p>Username: {username}</p>
                <p>You will be required to set a new password the next time you log in.</p>
                <p>If you didn't expect this change, please contact your family admin immediately.</p>
                <p>Best regards,<br>Family Wishlist Team</p>
            </body>
            </html>
            """
        },
        {
            "name": "household_request",
            "subject": "Family Wishlist - Household Join Request",
            "body": """
            <html>
            <body>
                <h2>Household Join Request</h2>
                <p>Hello {user_name},</p>
                <p>You have requested to join the household: {household_name}</p>
                <p>Your request is pending approval by the household administrator.</p>
                <p>You will receive an email notification once your request is reviewed.</p>
                <p>Best regards,<br>Family Wishlist Team</p>
            </body>
            </html>
            """
        },
        {
            "name": "household_approved",
            "subject": "Family Wishlist - Household Request Approved",
            "body": """
            <html>
            <body>
                <h2>Household Request Approved</h2>
                <p>Hello {user_name},</p>
                <p>Great news! Your request to join {household_name} has been approved.</p>
                <p>You can now view and interact with wishlists from other members of this household.</p>
                <p>Best regards,<br>Family Wishlist Team</p>
            </body>
            </html>
            """
        },
        {
            "name": "household_declined",
            "subject": "Family Wishlist - Household Request Declined",
            "body": """
            <html>
            <body>
                <h2>Household Request Declined</h2>
                <p>Hello {user_name},</p>
                <p>Your request to join {household_name} has been declined.</p>
                <p>You may contact the household administrator for more information.</p>
                <p>Best regards,<br>Family Wishlist Team</p>
            </body>
            </html>
            """
        }
    ]
    
    for template_data in templates:
        existing = db.query(EmailTemplate).filter(EmailTemplate.name == template_data["name"]).first()
        if not existing:
            template = EmailTemplate(**template_data)
            db.add(template)
    
    try:
        db.commit()
        logger.info("Default email templates created successfully")
    except Exception as e:
        logger.error(f"Failed to create default email templates: {e}")
        db.rollback() 