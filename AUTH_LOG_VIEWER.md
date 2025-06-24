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
- **Log File**: Reads from `/app/data/auth.log`
- **Parsing**: Custom parser for AUTH event messages
- **Filtering**: Server-side filtering for performance

### Frontend
- **Component**: `AuthLogViewer.jsx`
- **API Integration**: Uses `getAuthLogs()` function
- **State Management**: React hooks for filters and pagination
- **UI Framework**: Tailwind CSS with Framer Motion animations

## Usage

1. **Navigate to Admin Panel**: Go to the admin section of the application
2. **Select System Tab**: Click on the "System" tab in the admin interface
3. **View Logs**: The Authentication Log Viewer will be displayed below the Emergency Token Manager
4. **Apply Filters**: Use the filter options to narrow down the log entries
5. **Search**: Use the search bar to find specific entries
6. **Load More**: Click "Load More" to view older log entries

## Troubleshooting

### No Logs Displayed
- Check if the log file exists at `/app/data/auth.log`
- Verify admin privileges
- Check browser console for API errors

### Performance Issues
- Reduce the number of logs loaded (default: 50)
- Use filters to narrow down results
- Check server logs for any parsing errors

### Missing Events
- Ensure authentication events are being logged properly
- Check log file permissions
- Verify log rotation settings

## Future Enhancements

- **Export Functionality**: Export logs to CSV/JSON
- **Real-time Updates**: WebSocket integration for live log updates
- **Advanced Analytics**: Charts and statistics for authentication patterns
- **Alert System**: Notifications for suspicious authentication patterns
- **Log Retention**: Configurable log retention policies 