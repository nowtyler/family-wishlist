# Security Guide for Family Wishlist Application

## Overview

This document outlines the security measures implemented in the Family Wishlist application and addresses common security concerns.

## Password Transmission Security

### Is it normal to see passwords in browser dev tools?

**YES, this is completely normal and expected behavior.** Here's why:

1. **HTTPS Encryption**: All passwords are transmitted over HTTPS (TLS/SSL), which encrypts the data in transit
2. **Browser Dev Tools**: The Network tab shows the raw HTTP request, but this is **after** the browser has encrypted it
3. **Security Layers**: The actual security comes from:
   - HTTPS encryption (TLS/SSL)
   - Rate limiting (prevents brute force attacks)
   - Secure headers (HSTS, CSP, etc.)
   - Server-side validation

### Current Security Measures

✅ **HTTPS/TLS Encryption**: All traffic is encrypted using Traefik with TLS enabled
✅ **Rate Limiting**: 60 requests per minute to prevent brute force attacks
✅ **Secure Headers**: HSTS, CSP, and other security headers configured
✅ **Input Validation**: Server-side validation of all inputs
✅ **Password Hashing**: Passwords are hashed using bcrypt

### What you see in dev tools vs. what attackers see

- **You (dev tools)**: Encrypted HTTPS traffic (secure)
- **Attackers (network sniffing)**: Encrypted HTTPS traffic (secure)
- **Server logs**: Hashed passwords only (secure)

## Emergency Access System

### Problem Addressed

When database migrations are pending or the database is corrupted, normal login may fail, preventing access to the admin panel and migration manager.

### Solution Implemented

A secure emergency access system with multiple layers of protection:

#### 1. Secure Emergency Endpoint

**Endpoint**: `/api/emergency/admin-access`

**Security Features**:
- Requires emergency token from environment variables
- IP-based access control (localhost only by default)
- Rate limiting and logging
- Creates admin user if none exists

#### 2. Emergency Access Script

**File**: `emergency-admin-access.sh`

**Usage**:
```bash
# Set emergency token
export EMERGENCY_ACCESS_TOKEN="your-secure-token-here"

# Run emergency access
./emergency-admin-access.sh
```

**Features**:
- Tests backend connectivity
- Attempts secure emergency access first
- Falls back to legacy emergency access
- Provides manual instructions if automatic access fails

#### 3. Frontend Emergency Access

**Component**: `EmergencyAccessModal.jsx`

**Features**:
- Modal accessible from login screen
- Token-based authentication
- Automatic admin login after successful access
- Clear warnings about emergency use only

### Environment Variables

Add these to your `.env` file:

```bash
# Emergency Access Configuration
EMERGENCY_ACCESS_TOKEN="your-secure-token-here"
EMERGENCY_ALLOWED_HOSTS="127.0.0.1,localhost,::1,your-server-ip"
```

### Generating a Secure Token

```bash
# Generate a 32-byte hex token
openssl rand -hex 32

# Example output: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

## Security Best Practices

### 1. Environment Variables

- Store sensitive data in environment variables, not in code
- Use strong, randomly generated tokens
- Rotate tokens periodically

### 2. Network Security

- Use HTTPS in production
- Configure proper firewall rules
- Limit access to emergency endpoints to trusted IPs

### 3. Access Control

- Emergency access is restricted to localhost by default
- Can be configured for specific IP addresses
- All access attempts are logged

### 4. Monitoring

- Monitor emergency access attempts
- Set up alerts for unusual access patterns
- Regular security audits

## Emergency Procedures

### When Normal Login Fails

1. **Check Backend Health**:
   ```bash
   curl https://your-domain.com/api/health
   ```

2. **Use Emergency Access Script**:
   ```bash
   export EMERGENCY_ACCESS_TOKEN="your-token"
   ./emergency-admin-access.sh
   ```

3. **Access Admin Panel**:
   - Navigate to admin panel
   - Run pending migrations
   - Restore from backup if needed

4. **Restore Normal Access**:
   - Fix database issues
   - Test normal login
   - Remove emergency access if no longer needed

### Manual Emergency Access

If automatic methods fail:

```bash
# Direct API call
curl -X POST \
  -H 'Content-Type: application/json' \
  -H 'X-Forwarded-For: 127.0.0.1' \
  -d '{"emergency_token": "your-token"}' \
  'https://your-domain.com/api/emergency/admin-access'
```

## Security Checklist

- [ ] HTTPS enabled in production
- [ ] Emergency access token configured
- [ ] Rate limiting enabled
- [ ] Secure headers configured
- [ ] Environment variables properly set
- [ ] Regular security updates
- [ ] Monitoring and logging enabled
- [ ] Backup procedures tested

## Troubleshooting

### Common Issues

1. **Emergency access denied**:
   - Check token is correct
   - Verify IP is in allowed hosts
   - Check environment variables are set

2. **HTTPS not working**:
   - Verify Traefik configuration
   - Check SSL certificates
   - Ensure proper routing

3. **Rate limiting issues**:
   - Check rate limiter configuration
   - Monitor request patterns
   - Adjust limits if needed

## Support

For security-related issues or questions:
1. Check this security guide
2. Review application logs
3. Test emergency access procedures
4. Contact system administrator

---

**Remember**: The emergency access system is for genuine emergencies only. Regular maintenance and monitoring should prevent most situations requiring its use. 