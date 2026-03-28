# Family Wishlist - Comprehensive Application Audit

**Date**: March 28, 2026 | **Branch**: `new-tab-menu`

## Overall Health Summary

The application is functional with a solid feature set, but carries **significant security debt**. The most critical issues are: secrets committed to git, a fundamentally broken authentication model (trusting client-supplied headers), and a database file tracked in version control. The frontend is relatively clean with no XSS vulnerabilities found, but has excessive debug logging. Infrastructure config needs hardening (Nginx headers, CORS, Docker).

**Totals**: 5 Critical | 11 High | 13 Medium | 6 Low

---

## 1. Security Audit

### CRITICAL

| # | Location | Issue | Recommendation |
|---|----------|-------|----------------|
| 1 | ~~RETRACTED~~ | ~~Root `.env` is NOT tracked in git~~ - this finding was incorrect. Root `.env` is properly gitignored. | N/A |
| 2 | `data/wishlist.db` | **SQLite database committed to git** - contains all user data, password hashes, personal info | `git rm --cached data/wishlist.db`, use BFG to scrub history |
| 3 | `backend/app/main.py:237-241` | **Auth trusts client header** - `X-Current-User-ID` header accepted without cryptographic validation. Any user can impersonate anyone by sending arbitrary header | Implement JWT/session-based auth; server must derive user ID from signed token |
| 4 | `frontend/.env` line 3 | **Hardcoded internal IP** (`192.168.50.48:8001`) committed, exposes network topology | Move to `.env.local` (gitignored) |
| 5 | `backend/app/main.py` (13+ locations) | **Admin role via string match** - `user.name.lower() == 'admin'` used for authorization instead of `is_admin` flag. Any user named "admin" gets admin privileges | Replace all with `user.is_admin` checks; create `require_admin()` dependency |

### HIGH

| # | Location | Issue | Recommendation |
|---|----------|-------|----------------|
| 6 | `main.py:1630-1677` | **SSRF via URL scraper** - `/api/items/fetch-url-details` accepts arbitrary URLs with no domain validation, no internal IP blocking | Add domain whitelist, block RFC1918 ranges, add timeouts |
| 7 | `main.py:108-129` | **Overly permissive CORS** - `allow_methods=["*"]`, `allow_headers=["*"]`, dev IPs mixed with prod origins, HTTP allowed alongside HTTPS | Explicit methods/headers, env-based origin lists, HTTPS-only in prod |
| 8 | `frontend/nginx.conf` | **Missing security headers** - No X-Frame-Options, CSP, HSTS, X-Content-Type-Options, Referrer-Policy | Add all standard security headers |
| 9 | `main.py:131-136` | **No CSRF protection** - acknowledged in TODO comment but not implemented | Implement double-submit cookie or synchronizer token pattern |
| 10 | `docker-compose.yml` | **Secrets as env vars** - Turnstile keys, webhook creds passed as plaintext environment variables visible via `docker inspect` | Use Docker secrets or external secret management |
| 11 | `backend/docker-entrypoint.sh:42` | **DB file permissions 644** - readable by all users on system | Change to `chmod 600` |
| 13 | `main.py` (multiple) | **Inconsistent household access control** - comments and shopping cart don't validate household membership | Create shared access-check utility, apply consistently |

### MEDIUM

| # | Location | Issue | Recommendation |
|---|----------|-------|----------------|
| 14 | `main.py` (multiple) | **Error messages leak internals** - raw `str(e)` in HTTPException details | Log full errors server-side, return generic messages to clients |
| 15 | `main.py:1440-1463` | **Health check leaks DB path** - `database_path` in response | Return only boolean connectivity status |
| 16 | `main.py:2912-3049` | **Password reset token expiration unclear** - no visible TTL, no single-use enforcement | Add 24hr TTL, mark tokens as used, log attempts |
| 17 | `backend/app/auth.py:150-152` | **Silent password truncation** - bcrypt's 72-byte limit applied silently | Reject passwords >72 bytes with clear error |
| 18 | No implementation | **No account lockout** - rate limiting by IP exists but no per-account lockout | Lock account after 10 failed attempts |
| 19 | No implementation | **No audit logging** - no immutable log of admin actions, deletions, password changes | Create audit table for sensitive operations |

---

## 2. Dead Code & Unnecessary Endpoints

| # | Location | Severity | Issue |
|---|----------|----------|-------|
| 20 | `api.js:137-153` | High | `verifyPassword()` - defined, imported in AuthScreen but never called |
| 21 | `api.js:649-659` | High | `importExternalWishlist()` - exported but never imported anywhere |
| 22 | `api.js:661-680` | High | `syncExternalWishlist()` - exported but never imported anywhere |
| 23 | `main.py:1052-1053` | Low | `VersionUpdate` BaseModel class defined inline instead of using schemas module |

---

## 3. Configuration & Environment

| # | Location | Severity | Issue |
|---|----------|----------|-------|
| 26 | `backend/Dockerfile:23` | High | `ENV ENVIRONMENT=prod` as default - dev builds get prod config. Default to `development` |

---

## 4. Error Handling & Resilience

| # | Location | Severity | Issue |
|---|----------|----------|-------|
| 28 | `main.py` (multiple) | Medium | Raw exceptions in HTTP responses (see #14 above) |
| 30 | `AppContext.jsx` | Medium | No error boundary wrapping context provider - context failures crash app |

---

## 5. Data Flow & Consistency

| # | Location | Severity | Issue |
|---|----------|----------|-------|
| 31 | `AppContext.jsx:11-16` | Medium | **Auth in sessionStorage** - `wishlistAuthenticated` flag and full user object stored as plaintext JSON, vulnerable to XSS. Acknowledged as TODO lines 24-26. Migrate to HTTP-only cookies |
| 32 | `api.js:471-483` | Medium | User ID from sessionStorage sent as header without validation - can be manipulated |
| 33 | `WishlistCard.jsx:44-78` | Low | JSDoc typedef missing `is_shared_wishlist` and `shared_wishlist_id` properties used at runtime |

---


---

## 7. Code Quality & Maintainability

| # | Location | Severity | Issue |
|---|----------|----------|-------|
| 40 | `main.py` (multiple) | Medium | **Inconsistent admin checks** - mix of `user.is_admin` and `user.name.lower() == 'admin'` (see #5) |
| 41 | `main.py` (multiple) | Low | Inconsistent HTTP status codes - some endpoints return 404, others 400 for similar error conditions |

---

## Priority Remediation Order

1. **Immediate**: Remove `.env` and `data/wishlist.db` from git, rotate all secrets
2. **Urgent**: Replace header-based auth with JWT/session tokens
3. **Urgent**: Standardize admin checks to `is_admin` flag only
4. **High**: Add SSRF protections to URL scraper
5. **High**: Add Nginx security headers, fix CORS
6. **High**: Create `.dockerignore`, fix Dockerfile defaults
7. **Medium**: Add CSRF protection, error boundaries, pagination
8. **Medium**: Remove dead code, reduce logging verbosity
9. **Low**: Performance optimizations (N+1 queries, memoization)

---

## Verification

After remediation:
- Run `git log --all --diff-filter=A -- .env data/` to confirm secrets removed from history
- Test all admin endpoints with non-admin user to verify `is_admin` checks
- Run `curl -H "X-Current-User-ID: 999" /api/family-members` to verify JWT enforcement
- Check `curl -I https://wishlist.ariahive.top` for security headers
- Run `pip-audit` on backend dependencies
- Verify CORS with cross-origin request from unauthorized domain
