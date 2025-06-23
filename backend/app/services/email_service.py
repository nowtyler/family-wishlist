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
    
    def _validate_gmail_settings(self):
        """Validate Gmail-specific settings"""
        if not self.settings:
            return False
            
        if 'gmail.com' in self.settings.smtp_server.lower():
            # Validate Gmail requirements
            if self.settings.smtp_port not in [465, 587]:
                logger.error("Gmail requires port 465 (SSL) or 587 (TLS)")
                return False
                
            # Ensure username is a full email address
            if '@' not in self.settings.smtp_username:
                logger.error("Gmail requires the full email address as username")
                return False
                
            # Validate TLS settings
            if self.settings.smtp_port == 587 and not self.settings.use_tls:
                logger.error("Gmail port 587 requires TLS to be enabled")
                return False
                
        return True
    
    def _send_email(self, to_email: str, subject: str, body: str, 
                   recipient_name: str = None) -> bool:
        """Send email using SMTP"""
        if not self.settings:
            logger.error("No active email settings found")
            return False
            
        # Add Gmail validation
        if not self._validate_gmail_settings():
            return False
        
        try:
            # Log connection attempt
            logger.info(f"Attempting to connect to SMTP server: {self.settings.smtp_server}:{self.settings.smtp_port}")
            logger.info(f"Using SSL: {self.settings.smtp_port == 465}, Using TLS: {self.settings.use_tls}")
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = f"{self.settings.from_name} <{self.settings.from_email}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Add body
            msg.attach(MIMEText(body, 'html'))
            
            # Create SMTP session with timeout
            context = ssl.create_default_context()
            
            try:
                # For Gmail's port 465, use SMTP_SSL
                if self.settings.smtp_port == 465:
                    logger.info("Using SMTP_SSL for port 465")
                    server = smtplib.SMTP_SSL(
                        self.settings.smtp_server, 
                        self.settings.smtp_port,
                        context=context,
                        timeout=30  # 30 second timeout
                    )
                else:
                    # For Gmail's port 587
                    logger.info("Using standard SMTP with STARTTLS")
                    server = smtplib.SMTP(
                        self.settings.smtp_server, 
                        self.settings.smtp_port,
                        timeout=30  # 30 second timeout
                    )
                    if self.settings.use_tls:
                        logger.info("Starting TLS")
                        server.starttls(context=context)
                
                logger.info("SMTP connection established successfully")
                
                # Gmail requires the username to be the full email address
                username = self.settings.smtp_username
                if '@' not in username and 'gmail.com' in self.settings.smtp_server:
                    username = f"{username}@gmail.com"
                    logger.info("Adjusted username for Gmail authentication")
                
                # Attempt login
                logger.info(f"Attempting login with username: {username}")
                server.login(username, self.settings.smtp_password)
                logger.info("Login successful")
                
                # Send email
                logger.info(f"Attempting to send email to: {to_email}")
                server.send_message(msg)
                logger.info("Email sent successfully")
                
                # Cleanup
                server.quit()
                return True
                
            except smtplib.SMTPAuthenticationError as auth_error:
                logger.error(f"SMTP Authentication failed: {auth_error}")
                if "Application-specific password required" in str(auth_error):
                    logger.error("Gmail requires an App Password. Please generate one from Google Account settings -> Security -> 2-Step Verification -> App passwords")
                return False
                
            except smtplib.SMTPConnectError as conn_error:
                logger.error(f"Failed to connect to SMTP server: {conn_error}")
                return False
                
            except smtplib.SMTPServerDisconnected as disc_error:
                logger.error(f"Server disconnected unexpectedly: {disc_error}")
                return False
                
            except smtplib.SMTPException as smtp_error:
                logger.error(f"SMTP error occurred: {smtp_error}")
                return False
                
            except ssl.SSLError as ssl_error:
                logger.error(f"SSL/TLS error occurred: {ssl_error}")
                return False
                
            except TimeoutError as timeout_error:
                logger.error(f"Connection timed out: {timeout_error}")
                return False
            
        except Exception as e:
            logger.error(f"Unexpected error while sending email: {str(e)}")
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
        # Use the test_email template
        return self.send_template_email(
            "test_email",
            test_email,
            "Test User",
            {"timestamp": get_est_timestamp_strftime("%Y-%m-%d %H:%M:%S")}
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
            <html>
            <body>
                <p>Hello {{user_name}},</p>

                <p>You have requested to reset your password. Please click the link below to reset your password:</p>

                <p>{{reset_url}}</p>

                <p>If you did not request this password reset, please ignore this email.</p>

                <p>Best regards,<br>
                Family Wishlist Team</p>
            </body>
            </html>
            """
        },
        {
            "name": "welcome_user",
            "subject": "Welcome to Family Wishlist!",
            "body": """
            <html>
            <body>
                <h2>Welcome to Family Wishlist, {{user_name}}!</h2>
                
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
                    <li>Username: {{username}}</li>
                    <li>Email: {{email}}</li>
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
            <html>
            <body>
                <h2>Hello {{name}},</h2>

            <h2>Your password has been successfully changed.</h2>

            <p>If you did not make this change, please contact the administrator immediately.</p>

            <p>Best regards,<br>
            Family Wishlist Team</p>
            """
        },
        {
            "name": "test_email",
            "subject": "Test Email",
            "body": """
            <html>
            <body>
                <p>Hello,</p>

            <h2>This is a test email to verify your email settings.</h2>

            <p>If you received this email, your email settings are configured correctly.</p>

            <p>Best regards,<br>
            Family Wishlist Team</p>
            </body>
            </html>
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