# Authentication Log Viewer

## Overview

The Authentication Log Viewer is a new admin feature that displays recent authentication events from the system's log files. It provides a comprehensive view of all login, logout, registration, and other authentication-related activities with color coding for easier readability.

## Features

### 🔍 **Real-time Log Display**
- Shows recent authentication logs from `/app/data/auth.log`
- Displays timestamps, usernames, IP addresses, and event details
- Sorted by timestamp (newest first)

### 🎨 **Color-coded Event Types**
- **LOGIN**: Green - Successful user logins
- **LOGOUT**: Blue - User logout events
- **REGISTER**: Purple - New user registrations
- **PASSWORD_RESET_***: Orange/Yellow/Indigo/Teal - Password reset events
- **AUTH_FAILURE**: Red - Failed authentication attempts
- **LOCKOUT**: Dark Red - Account lockouts due to failed attempts
- **EMAIL_SEND**: Cyan - Email-related events
- **ERROR**: Red - Authentication errors

### 🔧 **Advanced Filtering**
- **Event Type Filter**: Filter by specific event types (LOGIN, LOGOUT, REGISTER, etc.)
- **Username Filter**: Filter logs by specific usernames
- **Status Filter**: Show only successful or failed events
- **Search Bar**: Global search across all log fields

### 📊 **Pagination & Performance**
- Loads 50 logs at a time for optimal performance
- "Load More" functionality for viewing older logs
- Efficient parsing and filtering of log entries

## Access

The Authentication Log Viewer is available in the **Admin Panel** under the **System** tab. Only users with admin privileges can access this feature.

## Log Format

The system logs authentication events in the following format:
```
2024-01-15T10:30:45.123Z - auth - INFO - AUTH SUCCESS - LOGIN - User: john_doe - IP: 192.168.1.100 - Details: User ID: 123, Admin: false
```

### Parsed Fields
- **Timestamp**: When the event occurred
- **Event Type**: Type of authentication event
- **Username**: User involved in the event
- **IP Address**: Client IP address
- **Success Status**: Whether the event was successful
- **Details**: Additional information about the event

## Event Types

### User Authentication
- `LOGIN` - Successful user login
- `LOGOUT` - User logout
- `LOGIN_ATTEMPT` - Login attempt (before validation)
- `AUTH_FAILURE` - Failed authentication attempt
- `AUTH_RESET` - Reset after failed attempts
- `LOCKOUT` - Account locked due to too many failures

### User Registration
- `REGISTER` - New user registration
- `REGISTER_ATTEMPT` - Registration attempt
- `REGISTER_ERROR` - Registration error

### Password Management
- `PASSWORD_RESET_REQUEST` - Password reset requested
- `PASSWORD_RESET_TOKEN` - Reset token generated
- `PASSWORD_RESET_CONFIRM` - Reset token confirmed
- `PASSWORD_RESET_COMPLETE` - Password successfully reset
- `PASSWORD_RESET_ERROR` - Password reset error

### System Events
- `EMAIL_SEND` - Email sending events
- `LOGIN_ERROR` - Login system errors
- `REGISTER_ERROR` - Registration system errors

## Security Considerations

- **Admin Only**: This feature is restricted to admin users only
- **Audit Trail**: Provides comprehensive audit trail for security monitoring
- **IP Tracking**: Logs client IP addresses for security analysis
- **No Sensitive Data**: Passwords and tokens are never logged

## Technical Implementation

### Backend
- **Endpoint**: `GET /api/admin/system/auth-logs`
- **Authentication**: Requires admin privileges
- **Log File**: Reads from `/app/data/auth.log` (Docker-compatible)
- **Parsing**: Custom parser for AUTH event messages
- **Filtering**: Server-side filtering for performance

### Frontend
- **Component**: `AuthLogViewer.jsx`
- **API Integration**: Uses `getAuthLogs()` function
- **State Management**: React hooks for filters and pagination
- **UI Framework**: Tailwind CSS with Framer Motion animations

## Docker Environment

### Log File Configuration
The system is configured to work in Docker environments with the following log file paths (in order of preference):
1. `/app/data/auth.log` - Primary Docker path
2. `./data/auth.log` - Relative path fallback
3. `auth.log` - Current directory fallback
4. `/tmp/auth.log` - System temp fallback

### Permissions
The Docker entrypoint script automatically:
- Creates the `/app/data/auth.log` file if it doesn't exist
- Sets proper ownership using `PUID` and `PGID` environment variables
- Sets appropriate file permissions (644)

### Environment Variables
- `PUID` - User ID for file permissions (default: 1000)
- `PGID` - Group ID for file permissions (default: 1000)
- `ENVIRONMENT` - Environment type (prod/dev)

## Usage

1. **Navigate to Admin Panel**: Go to the admin section of the application
2. **Select System Tab**: Click on the "System" tab in the admin interface
3. **View Logs**: The Authentication Log Viewer will be displayed below the Emergency Token Manager
4. **Apply Filters**: Use the filter options to narrow down the log entries
5. **Search**: Use the search bar to find specific entries
6. **Load More**: Click "Load More" to view older log entries

## Troubleshooting

### No Logs Displayed

#### Check Log File Status
1. **Verify log file exists**: Check if `/app/data/auth.log` exists in the container
2. **Check file permissions**: Ensure the file is owned by the correct user (PUID/PGID)
3. **Check file size**: Verify the log file has content (not 0 bytes)

#### Docker Container Debugging
```bash
# Check if log file exists and has content
docker exec wishlist-backend ls -la /app/data/auth.log

# Check file permissions
docker exec wishlist-backend stat /app/data/auth.log

# View log file content
docker exec wishlist-backend cat /app/data/auth.log

# Check container logs for authentication events
docker logs wishlist-backend | grep "AUTH"

# Test logging functionality
docker exec wishlist-backend python test_logging.py
```

#### Environment Variables
Verify these environment variables are set correctly:
- `PUID` - Should match your host user ID
- `PGID` - Should match your host group ID
- `ENVIRONMENT` - Should be set to `prod` or `dev`

#### Manual Testing
Run the test script inside the container:
```bash
docker exec wishlist-backend python test_logging.py
```

### Performance Issues
- Reduce the number of logs loaded (default: 50)
- Use filters to narrow down results
- Check server logs for any parsing errors

### Missing Events
- Ensure authentication events are being logged properly
- Check log file permissions
- Verify log rotation settings
- Check Docker container logs for console output

### Common Issues

#### Empty Log File (0 bytes)
**Cause**: Log file exists but has no content
**Solution**: 
1. Perform some authentication actions (login, logout, register)
2. Check if logs are being written to console instead of file
3. Verify the application has write permissions to the log file

#### Permission Denied Errors
**Cause**: Incorrect file ownership or permissions
**Solution**:
1. Restart the container to trigger the entrypoint script
2. Manually set permissions: `chown PUID:PGID /app/data/auth.log`
3. Check that PUID/PGID environment variables are set correctly

#### Logs Only in Console
**Cause**: File logging failed, falling back to console
**Solution**:
1. Check Docker container logs: `docker logs wishlist-backend`
2. Verify volume mounts are correct
3. Ensure data directory is writable

## Future Enhancements

- **Export Functionality**: Export logs to CSV/JSON
- **Real-time Updates**: WebSocket integration for live log updates
- **Advanced Analytics**: Charts and statistics for authentication patterns
- **Alert System**: Notifications for suspicious authentication patterns
- **Log Retention**: Configurable log retention policies
- **Multiple Log Sources**: Support for reading from multiple log files
- **Log Rotation**: Automatic log rotation and cleanup 