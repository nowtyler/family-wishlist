# Family Wishlist - Major Update Changelog

## Overview
This major update implements a comprehensive admin system with improved user management, household functionality, email integration, and enhanced security. The legacy login system has been removed in favor of user ID-based authentication.

## Database Changes

### New Models Added
- **Household**: Manages family groups with many-to-many relationships
- **EmailSettings**: SMTP configuration for email functionality
- **EmailTemplate**: Reusable email templates for notifications
- **EmailLog**: Audit trail for sent emails
- **user_household_association**: Junction table for user-household relationships

### Enhanced FamilyMember Model
- Added `password_expires_at` field for password expiration
- Added `temp_password_hash` for temporary password storage
- Added `force_password_change` flag for admin-forced password changes
- Added relationship to households

## Backend Changes

### New Services
- **EmailService**: Complete SMTP email functionality with templates
- Enhanced authentication with password expiration support
- Household management with approval workflows
- Email template system with default templates

### New API Endpoints
- `/api/admin/households/*` - Household management
- `/api/admin/email/*` - Email settings and templates
- `/api/admin/users/profile` - User profile management
- Enhanced password reset with email integration
- Household request/approval endpoints

### Enhanced Authentication
- Removed legacy password verification
- Added password expiration logic
- Force password change on admin reset
- Email notifications for password changes

## Frontend Changes

### New Components
- **AdminPage.jsx**: Comprehensive admin dashboard with tabs
  - Dashboard overview with statistics
  - User management with individual wishlist clearing
  - Household management
  - Email configuration
  - Database migrations
  - Backup management
  - System settings

- **EnhancedUpcomingEventsBanner.jsx**: Improved events display
  - Shows most recent upcoming event by default
  - Expandable dropdown to view all events
  - Better visual hierarchy and styling

### Updated Components

#### App.jsx
- Removed legacy user selection screen routing
- Added admin route protection
- Redirect admin users to admin page on login
- Simplified routing logic

#### AuthScreen.jsx
- Removed legacy login option completely
- Enhanced admin detection and routing
- Improved error handling and user feedback

#### Navbar.jsx
- Removed "Change User" option
- Added "Edit Profile" option for non-admin users
- Updated admin detection logic
- Improved settings menu organization

#### DashboardScreen.jsx
- Integrated enhanced upcoming events banner
- Updated admin detection to use `is_admin` field
- Improved user filtering logic
- Enhanced error handling

### Removed Components
- **UserSelectionScreen.jsx**: No longer needed with user ID-based login
- Legacy authentication flow components

## Security Improvements

### Authentication
- Removed legacy family password system
- Implemented proper user ID-based authentication
- Added password expiration and forced change functionality
- Enhanced password reset with email verification

### Access Control
- Admin-only routes properly protected
- User profile editing restricted to own account
- Household membership controls
- Email functionality admin-only

## Email System

### Features
- SMTP configuration through admin interface
- Email templates for common notifications:
  - Password reset
  - Welcome emails
  - Password change notifications
  - Household request/approval notifications
- Email logging and audit trail
- Test email functionality

### Templates Included
- Password reset emails
- Welcome emails for new users
- Password change notifications
- Household join requests
- Household approval/decline notifications

## Household System

### Features
- Multi-household support
- User membership in multiple households
- Request/approval workflow for joining households
- Admin management of household membership
- Email notifications for household actions

### Workflow
1. Users can request to join households
2. Admins approve/decline requests
3. Users receive email notifications
4. Pending users see status on login
5. Household members can view each other's wishlists

## User Management Enhancements

### Admin Features
- Individual user wishlist clearing
- Password reset with forced change
- User profile management
- Household assignment
- Email notification management

### User Features
- Self-service profile editing
- Password change functionality
- Email preferences
- Household membership management

## UI/UX Improvements

### Admin Dashboard
- Modern, tabbed interface
- Visual statistics and overview
- Quick action buttons
- Responsive design
- Dark mode support

### Enhanced Events Display
- Collapsible upcoming events banner
- Better visual hierarchy
- Improved date formatting
- Christmas-specific styling

### General Improvements
- Removed confusing legacy options
- Streamlined navigation
- Better error messages
- Improved loading states

## Migration Notes

### Database Migration Required
- New tables need to be created
- Existing user data preserved
- Email templates automatically created
- Default household structure can be set up

### Configuration Required
- SMTP settings need to be configured by admin
- Email templates can be customized
- Household structure should be planned
- User permissions may need adjustment

## Breaking Changes

### Authentication
- Legacy family password login removed
- All users must have individual accounts
- Admin users redirected to admin page
- Password reset requires email configuration

### Navigation
- User selection screen removed
- "Change User" option removed from navbar
- Admin functions moved to dedicated admin page

### API Changes
- Some legacy endpoints deprecated
- New authentication headers required
- Enhanced error responses
- New household-related endpoints

## Deployment Notes

### Environment Variables
- SMTP configuration required for email functionality
- Database migration scripts needed
- Email template initialization

### Docker Configuration
- No changes to existing Docker setup
- New database migrations will run automatically
- Email service requires SMTP configuration

## Future Considerations

### Potential Enhancements
- Advanced household permissions
- Email template editor in admin interface
- Bulk user operations
- Advanced reporting and analytics
- Mobile app support

### Security Enhancements
- Two-factor authentication
- Session management improvements
- Advanced audit logging
- Rate limiting enhancements

## Testing Recommendations

### Critical Test Areas
- Admin login and routing
- User registration and login
- Password reset functionality
- Email sending and templates
- Household management
- User profile editing
- Database migrations

### Browser Compatibility
- Tested on modern browsers
- Mobile responsive design
- Dark mode functionality
- Accessibility improvements

## Support and Documentation

### Admin Guide
- Email configuration instructions
- Household setup guide
- User management procedures
- System maintenance tasks

### User Guide
- Account creation and login
- Profile management
- Household membership
- Wishlist management

## [Unreleased] - Security & Emergency Access Improvements

### 🔒 Security Enhancements
- **Password Transmission Security**: Documented that HTTPS encryption makes password visibility in dev tools normal and secure
- **Emergency Access System**: Implemented secure emergency access for database issues
- **Rate Limiting**: Enhanced rate limiting for all authentication endpoints
- **Security Headers**: Added comprehensive security headers via Traefik configuration

### 🚨 Emergency Access System
- **Secure Emergency Endpoint**: New `/api/emergency/admin-access` endpoint with token-based authentication
- **IP-Based Access Control**: Emergency access restricted to localhost and configurable IP addresses
- **Emergency Access Script**: `emergency-admin-access.sh` for command-line emergency access
- **Enhanced Emergency Modal**: `EmergencyAccessModal.jsx` now includes full migration manager functionality
- **Migration Manager Integration**: Emergency access modal provides database upgrade and backup management
- **Environment Variables**: `EMERGENCY_ACCESS_TOKEN` and `EMERGENCY_ALLOWED_HOSTS` configuration
- **Fallback Support**: Legacy emergency access endpoint maintained for compatibility
- **Database Fix Script**: `fix-database-simple.py` for manual database schema fixes

### 🔧 Database & Migration Improvements
- **SQLAlchemy Relationship Fix**: Fixed `ExternalWishlist` model relationship conflict
- **Missing Column Detection**: Emergency access now detects and reports missing database columns
- **Migration Manager in Emergency Access**: Full migration functionality available in emergency modal
- **Backup Management**: Emergency access includes backup restore and deletion capabilities
- **Step-by-Step Workflow**: Emergency access guides users through database fixes

### 📚 Documentation
- **Security Guide**: Comprehensive `SECURITY_GUIDE.md` with security explanations and procedures
- **Emergency Procedures**: Step-by-step emergency access procedures documented
- **Troubleshooting**: Security troubleshooting guide included

### 🔧 Configuration
- **Docker Compose**: Added emergency access environment variables to both production and development services
- **Environment Setup**: Clear instructions for setting up emergency access tokens

### 🛡️ Security Features
- **Token Generation**: Instructions for generating secure emergency tokens
- **Access Logging**: All emergency access attempts are logged
- **IP Validation**: Real IP detection behind proxies
- **Multiple Fallbacks**: Multiple emergency access methods for reliability
- **Migration Manager Security**: Migration functions only available after emergency token validation

## [Previous Changes...]

---

**Note**: This update represents a significant architectural change. Please ensure proper testing and backup procedures are followed before deployment to production environments. 