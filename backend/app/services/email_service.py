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
import re
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
        
        # Always inject copyright_year so footers stay current automatically
        if template_vars is None:
            template_vars = {}
        template_vars.setdefault("copyright_year", str(datetime.now().year))

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
        """Send notification when password is changed"""
        template_vars = {
            "user_name": user.name,
            "username": user.username,
            "timestamp": get_est_timestamp_strftime("%Y-%m-%d %H:%M:%S")
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
    
    def send_maintenance_notice_to_all_users(self, maintenance_time: str = None, expected_downtime: str = None) -> int:
        """Send maintenance notice email to all users with an email address. Returns number of emails sent."""
        users = self.db.query(FamilyMember).filter(FamilyMember.email != None).all()
        if not users:
            logger.warning("No users with email addresses found for maintenance notice.")
            return 0
        # Compose template vars
        template_vars = {
            "maintenance_time": maintenance_time or "soon",
            "expected_downtime": expected_downtime or "1-2 hours"
        }
        sent_count = 0
        for user in users:
            vars_for_user = template_vars.copy()
            vars_for_user["user_name"] = user.name or "User"
            log = self.send_template_email(
                "maintenance_notice",
                user.email,
                user.name,
                vars_for_user
            )
            if log and getattr(log, 'status', None) == "sent":
                sent_count += 1
        return sent_count

    def send_update_notice_to_all_users(self, version: str = None, changes: str = None) -> int:
        """Send update/release notice email to all users with an email address. Returns number of emails sent."""
        users = self.db.query(FamilyMember).filter(FamilyMember.email != None).all()
        if not users:
            logger.warning("No users with email addresses found for update notice.")
            return 0
        template_vars = {
            "version": version or "latest",
            "changes": changes or "Various improvements and bug fixes."
        }
        sent_count = 0
        for user in users:
            vars_for_user = template_vars.copy()
            vars_for_user["user_name"] = user.name or "User"
            log = self.send_template_email(
                "update_notice",
                user.email,
                user.name,
                vars_for_user
            )
            if log and getattr(log, 'status', None) == "sent":
                sent_count += 1
        return sent_count

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
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Password Reset</title>
            </head>
            <body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f7fa;color:#333333;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7fa;">
                    <tr>
                        <td align="center" style="padding:40px 0;">
                            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:90%;">
                                <!-- Header -->
                                <tr>
                                    <td style="background:linear-gradient(to right, #0ea5e9, #6366f1);padding:30px 40px;text-align:center;">
                                        <h1 style="color:#ffffff;margin:0;font-weight:700;font-size:28px;">Family Wishlist</h1>
                                        <p style="color:#e0f2fe;margin:10px 0 0;font-size:16px;">Password Reset Request</p>
                                    </td>
                                </tr>
                                
                                <!-- Content -->
                                <tr>
                                    <td style="padding:30px 40px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td>
                                                    <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #3b82f6;border-radius:6px;padding:20px;margin-bottom:25px;">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td width="40" valign="top">
                                                                    <!-- Lock icon -->
                                                                    <div style="width:32px;height:32px;background-color:#3b82f6;border-radius:50%;display:inline-block;text-align:center;line-height:32px;">
                                                                        <img src="https://cdn-icons-png.flaticon.com/512/483/483408.png" width="16" height="16" alt="Lock" style="vertical-align:middle;filter:brightness(0) invert(1);">
                                                                    </div>
                                                                </td>
                                                                <td style="padding-left:15px;">
                                                                    <h3 style="margin:0;color:#1e40af;font-size:16px;font-weight:600;">Password Reset</h3>
                                                                    <p style="margin:10px 0 0;color:#334155;font-size:14px;">
                                                                        Hello,<br><br>
                                                                        You have requested to reset your password. This link will expire in 24 hours.
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </div>
                                                    
                                                    <div style="text-align:center;margin:30px 0;">
                                                        <a href="{{reset_url}}" style="background:linear-gradient(to right, #0ea5e9, #6366f1);color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:6px;font-weight:600;display:inline-block;font-size:16px;">Reset Password</a>
                                                    </div>
                                                    
                                                    <p style="margin:20px 0;color:#64748b;font-size:14px;">If you didn't request a password reset, you can safely ignore this email.</p>
                                                    
                                                    <p style="margin:25px 0 0;color:#64748b;font-size:14px;">Having trouble with the button above? Copy and paste the URL below into your web browser:</p>
                                                    <p style="margin:10px 0 0;color:#334155;font-size:12px;word-break:break-all;background-color:#f8fafc;padding:10px;border-radius:4px;border:1px solid #e2e8f0;">{{reset_url}}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color:#f1f5f9;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                                        <p style="margin:0;color:#64748b;font-size:14px;">
                                            &copy; {{copyright_year}} Family Wishlist. All rights reserved.
                                        </p>
                                        <p style="margin:10px 0 0;color:#94a3b8;font-size:12px;">
                                            This is an automated message, please do not reply.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
        },
        {
            "name": "welcome_user",
            "subject": "Welcome to Family Wishlist!",
            "body": """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to Family Wishlist</title>
            </head>
            <body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f7fa;color:#333333;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7fa;">
                    <tr>
                        <td align="center" style="padding:40px 0;">
                            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:90%;">
                                <!-- Header with gradient -->
                                <tr>
                                    <td style="background:linear-gradient(to right, #0ea5e9, #6366f1);padding:40px;text-align:center;">
                                        <img src="https://cdn-icons-png.flaticon.com/512/2589/2589175.png" alt="Gift" width="70" height="70" style="margin-bottom:15px;filter:brightness(0) invert(1);">
                                        <h1 style="color:#ffffff;margin:0;font-weight:700;font-size:28px;">Welcome to Family Wishlist!</h1>
                                        <p style="color:#e0f2fe;margin:10px 0 0;font-size:16px;">Hello, {{user_name}}! We're excited to have you join us.</p>
                                    </td>
                                </tr>
                                
                                <!-- Introduction -->
                                <tr>
                                    <td style="padding:30px 40px;">
                                        <p style="margin:0 0 20px;color:#334155;font-size:16px;line-height:1.6;">
                                            Thank you for joining Family Wishlist! We're thrilled to have you on board. 
                                            Below you'll find everything you need to know to get started with making gift-giving more meaningful and organized!
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Quick Start Guide Section -->
                                <tr>
                                    <td style="padding:0 40px 30px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td>
                                                    <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:25px;margin-bottom:25px;">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td width="40" valign="top">
                                                                    <!-- Map icon -->
                                                                    <div style="margin-top:3px;">
                                                                        <img src="https://cdn-icons-png.flaticon.com/512/5974/5974636.png" width="24" height="24" alt="Map" style="vertical-align:middle;filter:invert(40%) sepia(65%) saturate(4705%) hue-rotate(214deg) brightness(102%) contrast(101%);">
                                                                    </div>
                                                                </td>
                                                                <td style="padding-left:15px;">
                                                                    <h3 style="margin:0;color:#1e40af;font-size:18px;font-weight:600;">Quick Start Guide</h3>
                                                                    <ul style="margin:15px 0 0;padding:0 0 0 20px;color:#334155;">
                                                                        <li style="margin-bottom:10px;">Access your wishlist anytime at: <a href="https://wishlist.ariahive.top" style="color:#3b82f6;text-decoration:none;font-weight:500;">wishlist.ariahive.top</a></li>
                                                                        <li style="margin-bottom:10px;">Use the Quick Actions menu at the bottom of the screen — it's your main hub for adding items, browsing wishlists, and more</li>
                                                                        <li style="margin-bottom:10px;">Add items to your wishlist by pasting a URL to auto-fill product details, or enter them manually</li>
                                                                        <li style="margin-bottom:10px;">Browse family members' wishlists to see what they're hoping for</li>
                                                                        <li style="margin-bottom:10px;">Find links to external wishlists (like Amazon) for even more gift ideas</li>
                                                                    </ul>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Key Features Section -->
                                <tr>
                                    <td style="padding:0 40px 30px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td>
                                                    <div style="background-color:#fdf4ff;border:1px solid #f5d0fe;border-radius:8px;padding:25px;margin-bottom:25px;">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td width="40" valign="top">
                                                                    <!-- Star icon -->
                                                                    <div style="margin-top:3px;">
                                                                        <img src="https://cdn-icons-png.flaticon.com/512/1828/1828884.png" width="24" height="24" alt="Star" style="vertical-align:middle;filter:invert(28%) sepia(75%) saturate(7471%) hue-rotate(297deg) brightness(93%) contrast(92%);">
                                                                    </div>
                                                                </td>
                                                                <td style="padding-left:15px;">
                                                                    <h3 style="margin:0;color:#86198f;font-size:18px;font-weight:600;">Key Features</h3>
                                                                    <ul style="margin:15px 0 0;padding:0 0 0 20px;color:#334155;">
                                                                        <li style="margin-bottom:10px;"><span style="font-weight:600;color:#d946ef;">Sizes & Preferences:</span> View and edit clothing sizes, favorite colors, and other gift preferences</li>
                                                                        <li style="margin-bottom:10px;"><span style="font-weight:600;color:#d946ef;">Settings & Profile:</span> Edit your account, manage households, and import/export your wishlist data</li>
                                                                        <li style="margin-bottom:0;"><span style="font-weight:600;color:#d946ef;">Dark/Light Mode:</span> Toggle between dark and light themes based on your preference</li>
                                                                    </ul>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Gift Coordination -->
                                <tr>
                                    <td style="padding:0 40px 30px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td>
                                                    <div style="background-color:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;padding:25px;margin-bottom:25px;">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td width="40" valign="top">
                                                                    <!-- Heart icon -->
                                                                    <div style="margin-top:3px;">
                                                                        <img src="https://cdn-icons-png.flaticon.com/512/535/535285.png" width="24" height="24" alt="Heart" style="vertical-align:middle;filter:invert(25%) sepia(70%) saturate(6127%) hue-rotate(324deg) brightness(92%) contrast(93%);">
                                                                    </div>
                                                                </td>
                                                                <td style="padding-left:15px;">
                                                                    <h3 style="margin:0;color:#9d174d;font-size:18px;font-weight:600;">Gift Coordination</h3>
                                                                    <p style="margin:10px 0 0;color:#334155;line-height:1.6;">
                                                                        Switch between family members' wishlists to see what they're hoping for.
                                                                        Mark items as "thinking about" or "purchased" to coordinate gifts with the rest of the family!
                                                                    </p>
                                                                    <div style="margin-top:15px;">
                                                                        <table cellpadding="0" cellspacing="0" border="0">
                                                                            <tr>
                                                                                <td>
                                                                                    <div style="display:inline-block;background-color:#fecdd3;color:#be123c;padding:8px 15px;border-radius:30px;font-size:14px;font-weight:500;margin-right:10px;">
                                                                                        ♥ Thinking About
                                                                                    </div>
                                                                                </td>
                                                                                <td>
                                                                                    <div style="display:inline-block;background-color:#bbf7d0;color:#166534;padding:8px 15px;border-radius:30px;font-size:14px;font-weight:500;">
                                                                                        🛒 Purchased
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        </table>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Account Details -->
                                <tr>
                                    <td style="padding:0 40px 30px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td>
                                                    <div style="background-color:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:25px;margin-bottom:25px;">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td width="40" valign="top">
                                                                    <!-- User icon -->
                                                                    <div style="margin-top:3px;">
                                                                        <img src="https://cdn-icons-png.flaticon.com/512/456/456283.png" width="24" height="24" alt="User" style="vertical-align:middle;filter:invert(25%) sepia(19%) saturate(6396%) hue-rotate(234deg) brightness(94%) contrast(96%);">
                                                                    </div>
                                                                </td>
                                                                <td style="padding-left:15px;">
                                                                    <h3 style="margin:0;color:#3730a3;font-size:18px;font-weight:600;">Your Account Details</h3>
                                                                    <table cellpadding="0" cellspacing="0" border="0" style="margin-top:15px;">
                                                                        <tr>
                                                                            <td style="padding:8px 15px 8px 0;color:#6366f1;font-weight:500;">Username:</td>
                                                                            <td style="padding:8px 0;color:#334155;">{{username}}</td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td style="padding:8px 15px 8px 0;color:#6366f1;font-weight:500;">Email:</td>
                                                                            <td style="padding:8px 0;color:#334155;">{{email}}</td>
                                                                        </tr>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Help Button -->
                                <tr>
                                    <td style="padding:0 40px 30px;text-align:center;">
                                        <p style="margin:0 0 20px;color:#64748b;font-size:16px;">
                                            Need help getting started?
                                        </p>
                                        <div>
                                            <a href="https://wishlist.ariahive.top" style="display:inline-block;background-color:#64748b;color:#ffffff;text-decoration:none;padding:12px 25px;border-radius:6px;font-weight:600;font-size:14px;">
                                                <img src="https://cdn-icons-png.flaticon.com/512/189/189665.png" alt="Question" width="14" height="14" style="vertical-align:middle;margin-right:8px;filter:brightness(0) invert(1);">
                                                View Help & Tips
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color:#f1f5f9;padding:25px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                                        <p style="margin:0;color:#334155;font-size:16px;font-weight:500;">
                                            We hope you enjoy using Family Wishlist!
                                        </p>
                                        <p style="margin:15px 0 0;color:#64748b;font-size:14px;">
                                            &copy; {{copyright_year}} Family Wishlist. All rights reserved.
                                        </p>
                                        <p style="margin:10px 0 0;color:#94a3b8;font-size:12px;">
                                            This email was sent to {{email}}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
        },
        {
            "name": "password_changed",
            "subject": "Password Changed",
            "body": """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Password Changed</title>
            </head>
            <body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f7fa;color:#333333;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7fa;">
                    <tr>
                        <td align="center" style="padding:40px 0;">
                            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:90%;">
                                <!-- Header -->
                                <tr>
                                    <td style="background:linear-gradient(to right, #0ea5e9, #6366f1);padding:30px 40px;text-align:center;">
                                        <h1 style="color:#ffffff;margin:0;font-weight:700;font-size:28px;">Family Wishlist</h1>
                                        <p style="color:#e0f2fe;margin:10px 0 0;font-size:16px;">Account Update</p>
                                    </td>
                                </tr>
                                
                                <!-- Content -->
                                <tr>
                                    <td style="padding:40px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="text-align:center;">
                                                    <!-- Check icon -->
                                                    <div style="margin:0 auto 25px;">
                                                        <img src="https://cdn-icons-png.flaticon.com/512/4436/4436481.png" width="60" height="60" alt="Success" style="filter:invert(57%) sepia(83%) saturate(1372%) hue-rotate(121deg) brightness(91%) contrast(101%);">
                                                    </div>
                                                    <h2 style="margin:0 0 15px;color:#334155;font-size:24px;font-weight:600;">Password Changed Successfully</h2>
                                                    <p style="margin:0 0 25px;color:#64748b;font-size:16px;line-height:1.6;">
                                                        Hello {{user_name}},<br>
                                                        Your password was changed successfully on {{timestamp}}.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Security Notice -->
                                        <div style="background-color:#fff1f2;border:1px solid #fecdd3;border-left:4px solid #e11d48;border-radius:6px;padding:20px;margin:10px 0 25px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td width="40" valign="top">
                                                        <!-- Alert icon -->
                                                        <div style="margin-top:3px;">
                                                            <img src="https://cdn-icons-png.flaticon.com/512/1828/1828843.png" width="24" height="24" alt="Alert" style="vertical-align:middle;filter:invert(17%) sepia(99%) saturate(5266%) hue-rotate(335deg) brightness(83%) contrast(92%);">
                                                        </div>
                                                    </td>
                                                    <td style="padding-left:15px;">
                                                        <h3 style="margin:0;color:#be123c;font-size:16px;font-weight:600;">Security Alert</h3>
                                                        <p style="margin:10px 0 0;color:#64748b;font-size:14px;">
                                                            If you did not make this change, please contact the administrator immediately 
                                                            as your account may have been compromised.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>
                                        
                                        <div style="text-align:center;margin:30px 0 10px;">
                                            <a href="https://wishlist.ariahive.top" style="background:linear-gradient(to right, #0ea5e9, #6366f1);color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:6px;font-weight:600;display:inline-block;font-size:16px;">Go to Family Wishlist</a>
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color:#f1f5f9;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                                        <p style="margin:0;color:#64748b;font-size:14px;">
                                            &copy; {{copyright_year}} Family Wishlist. All rights reserved.
                                        </p>
                                        <p style="margin:10px 0 0;color:#94a3b8;font-size:12px;">
                                            This is an automated message, please do not reply.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
        },
        {
            "name": "test_email",
            "subject": "Test Email",
            "body": """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Test Email</title>
            </head>
            <body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f7fa;color:#333333;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7fa;">
                    <tr>
                        <td align="center" style="padding:40px 0;">
                            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:90%;">
                                <!-- Header -->
                                <tr>
                                    <td style="background:linear-gradient(to right, #0ea5e9, #6366f1);padding:30px 40px;text-align:center;">
                                        <h1 style="color:#ffffff;margin:0;font-weight:700;font-size:28px;">Family Wishlist</h1>
                                        <p style="color:#e0f2fe;margin:10px 0 0;font-size:16px;">Test Email</p>
                                    </td>
                                </tr>
                                
                                <!-- Content -->
                                <tr>
                                    <td style="padding:40px;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="text-align:center;">
                                                    <!-- Test icon -->
                                                    <div style="margin:0 auto 25px;">
                                                        <img src="https://cdn-icons-png.flaticon.com/512/471/471664.png" width="60" height="60" alt="Test" style="filter:invert(55%) sepia(70%) saturate(473%) hue-rotate(101deg) brightness(97%) contrast(94%);">
                                                    </div>
                                                    <h2 style="margin:0 0 15px;color:#334155;font-size:24px;font-weight:600;">Email Configuration Test</h2>
                                                    <p style="margin:0 0 25px;color:#64748b;font-size:16px;line-height:1.6;">
                                                        This is a test email to verify your email settings.<br>
                                                        If you're seeing this, your email configuration is working correctly!
                                                    </p>
                                                    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:15px;margin:25px 0;text-align:left;">
                                                        <h4 style="margin:0 0 10px;color:#166534;font-size:16px;">Test Information:</h4>
                                                        <table cellpadding="4" cellspacing="0" border="0" style="width:100%;font-size:14px;">
                                                            <tr>
                                                                <td style="color:#15803d;font-weight:500;width:120px;">Test Date:</td>
                                                                <td style="color:#334155;">{{timestamp}}</td>
                                                            </tr>
                                                            <tr>
                                                                <td style="color:#15803d;font-weight:500;width:120px;">Status:</td>
                                                                <td style="color:#16a34a;font-weight:500;">Successful</td>
                                                            </tr>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Back to Admin Panel -->
                                        <div style="text-align:center;margin:30px 0 10px;">
                                            <a href="https://wishlist.ariahive.top/admin" style="background:linear-gradient(to right, #0ea5e9, #6366f1);color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:6px;font-weight:600;display:inline-block;font-size:16px;">Go to Admin Panel</a>
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color:#f1f5f9;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                                        <p style="margin:0;color:#64748b;font-size:14px;">
                                            &copy; {{copyright_year}} Family Wishlist. All rights reserved.
                                        </p>
                                        <p style="margin:10px 0 0;color:#94a3b8;font-size:12px;">
                                            This is an automated message, please do not reply.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
        },
        {
            "name": "maintenance_notice",
            "subject": "Family Wishlist Maintenance Notice",
            "body": """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Maintenance Notice</title>
            </head>
            <body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f7fa;color:#333333;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7fa;">
                    <tr>
                        <td align="center" style="padding:40px 0;">
                            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:90%;">
                                <!-- Header -->
                                <tr>
                                    <td style="background:linear-gradient(to right, #0ea5e9, #6366f1);padding:30px 40px;text-align:center;">
                                        <h1 style="color:#ffffff;margin:0;font-weight:700;font-size:28px;">Family Wishlist</h1>
                                        <p style="color:#e0f2fe;margin:10px 0 0;font-size:16px;">Scheduled Maintenance</p>
                                    </td>
                                </tr>
                                <!-- Content -->
                                <tr>
                                    <td style="padding:40px;">
                                        <h2 style="margin:0 0 15px;color:#334155;font-size:24px;font-weight:600;">Dear {{user_name}},</h2>
                                        <p style="margin:0 0 25px;color:#64748b;font-size:16px;line-height:1.6;">
                                            Family Wishlist will be offline for maintenance on <b>{{maintenance_time}}</b>.<br>
                                            During maintenance, you will not be able to access the website. We apologize for any inconvenience and appreciate your understanding.
                                        </p>
                                        <div style="background-color:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:15px;margin:25px 0;text-align:left;">
                                            <h4 style="margin:0 0 10px;color:#b45309;font-size:16px;">Maintenance Details:</h4>
                                            <ul style="margin:0;padding-left:20px;">
                                                <li><b>Date/Time:</b> {{maintenance_time}}</li>
                                                <li><b>Expected Downtime:</b> {{expected_downtime}}</li>
                                            </ul>
                                        </div>
                                        <p style="margin:30px 0 0;color:#64748b;font-size:14px;">Thank you for your patience and support!</p>
                                    </td>
                                </tr>
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color:#f1f5f9;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                                        <p style="margin:0;color:#64748b;font-size:14px;">
                                            &copy; {{copyright_year}} Family Wishlist. All rights reserved.
                                        </p>
                                        <p style="margin:10px 0 0;color:#94a3b8;font-size:12px;">
                                            This is an automated message, please do not reply.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
        },
        {
            "name": "update_notice",
            "subject": "Family Wishlist Update — What's New",
            "body": """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Update Notice</title>
            </head>
            <body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f7fa;color:#333333;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7fa;">
                    <tr>
                        <td align="center" style="padding:40px 0;">
                            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:90%;">
                                <!-- Header -->
                                <tr>
                                    <td style="background:linear-gradient(to right, #0ea5e9, #6366f1);padding:30px 40px;text-align:center;">
                                        <h1 style="color:#ffffff;margin:0;font-weight:700;font-size:28px;">Family Wishlist</h1>
                                        <p style="color:#e0f2fe;margin:10px 0 0;font-size:16px;">New Update Available</p>
                                    </td>
                                </tr>
                                <!-- Content -->
                                <tr>
                                    <td style="padding:40px;">
                                        <h2 style="margin:0 0 15px;color:#334155;font-size:24px;font-weight:600;">Hey {{user_name}}!</h2>
                                        <p style="margin:0 0 25px;color:#64748b;font-size:16px;line-height:1.6;">
                                            Family Wishlist has been updated to version <b>{{version}}</b> with new features and improvements!
                                        </p>
                                        <div style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:15px;margin:25px 0;text-align:left;">
                                            <h4 style="margin:0 0 10px;color:#047857;font-size:16px;">What's New:</h4>
                                            <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;white-space:pre-line;">{{changes}}</p>
                                        </div>
                                        <p style="margin:30px 0 0;color:#64748b;font-size:14px;">Enjoy the new features!</p>
                                    </td>
                                </tr>
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color:#f1f5f9;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
                                        <p style="margin:0;color:#64748b;font-size:14px;">
                                            &copy; {{copyright_year}} Family Wishlist. All rights reserved.
                                        </p>
                                        <p style="margin:10px 0 0;color:#94a3b8;font-size:12px;">
                                            This is an automated message, please do not reply.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            """
        }
    ]

    for template in default_templates:
        existing = db.query(EmailTemplate).filter_by(name=template["name"]).first()
        if not existing:
            new_template = EmailTemplate()
            new_template.name = template["name"]
            new_template.subject = template["subject"]
            new_template.body = template["body"].strip()
            new_template.is_active = True
            db.add(new_template)

    # Migrate existing templates: replace any hardcoded copyright year with the dynamic variable
    for t in db.query(EmailTemplate).all():
        if t.body and '{{copyright_year}}' not in t.body:
            updated = re.sub(r'&copy;\s*\d{4}\s+Family Wishlist', '&copy; {{copyright_year}} Family Wishlist', t.body)
            if updated != t.body:
                t.body = updated

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create default templates: {e}")
        raise