# Claude Code Guidelines for Family Wishlist

## About This Application

Family Wishlist is a full-stack web application for coordinating gift-giving among family members. Users can create personal wishlists, browse others' wishlists, mark items as "thinking about purchasing" or "purchased," and coordinate through comments and status tracking. The goal is to prevent duplicate purchases and facilitate thoughtful gift-giving for holidays, birthdays, and special occasions.

### Tech Stack
- **Frontend**: React 18 + JavaScript, Vite, TailwindCSS, Framer Motion, React Router v6
- **Backend**: FastAPI (Python), SQLAlchemy ORM, Pydantic validation
- **Database**: SQLite
- **Deployment**: Docker, Docker Compose, Nginx, Traefik

### Key Features
- User authentication with password reset via email
- Wishlist CRUD with priority levels, prices, images, and external links
- Gift coordination (mark as "thinking about" or "purchased")
- Shared wishlists (multi-owner, for kids or joint gifts)
- Household management (group family members)
- Shopping cart for tracking planned purchases
- URL auto-import for product details
- Dark/light theme support
- Admin dashboard for family member management, backups, and migrations
- Gift event reminders (birthdays, Christmas)

---

## ⚠️ MAINTENANCE INSTRUCTION

**When you modify, add, or remove code in this project, you MUST update the relevant sections in this file:**

- If you add/remove/move **API routes** → Update "Backend Route Map"
- If you modify **database models** → Update "Data Model Relationships"
- If you add/remove **frontend components** → Update "Frontend Components"
- If you add/remove **API functions** in api.js → Update "API Function Categories"
- If you add/remove **contexts** → Update "Frontend Contexts"
- If you're working on a **new feature branch** → Update "Recent Development Context"

This keeps the reference accurate and saves tokens on future explorations.

---

## Critical Development Guidelines

### Make Only Necessary Changes
- **Surgical edits only**: This is a working production application. Every change must be intentional and minimal.
- **Read before editing**: Always read and understand existing code before modifying it. Never propose changes to code you haven't read.
- **Avoid over-engineering**: Don't add features, refactor code, or make "improvements" beyond what was requested.
- **No speculative changes**: Don't fix things that aren't broken. Don't add error handling for impossible scenarios.
- **Test your assumptions**: If unsure how something works, explore the codebase first.

### Preserve Application Stability
- **Don't break existing functionality**: Changes should be additive or targeted fixes, not rewrites.
- **Maintain backward compatibility**: Existing API contracts, database schemas, and component interfaces must remain stable.
- **Consider side effects**: Backend changes may affect the frontend. Database changes may require migrations.
- **Check imports and dependencies**: Ensure any modified code doesn't break imports elsewhere.

---

## Backend Route Map (main.py ~4550 lines)

Use these line ranges to jump directly to relevant sections instead of searching.

| Section | Lines | Key Routes |
|---------|-------|------------|
| **Family Members** | 242-577 | GET/POST/PUT/DELETE `/api/family-members` |
| **Admin Users** | 382-480 | POST `/api/admin/users`, PUT `/api/admin/users/{id}` |
| **Wishlist Items** | 614-930 | CRUD `/api/members/{id}/items`, toggle-thinking, toggle-purchased |
| **Import/Export** | 809-930 | GET `/api/members/{id}/export`, POST `/api/members/{id}/import` |
| **Comments** | 930-973 | POST `/api/items/{id}/comments`, DELETE `/api/comments/{id}` |
| **Gift Events** | 1000-1029 | GET `/api/upcoming-event` |
| **Migrations** | 1108-1276 | `/api/admin/migrations/*` |
| **Backups** | 1317-1401 | `/api/admin/backups/*` |
| **System Setup** | 1414-1530 | `/api/health`, `/api/system/*`, first-time-setup |
| **Recovery Passphrase** | 1535-1600 | `/api/admin/recovery-passphrase`, regenerate |
| **URL Scraping** | 1605-1650 | POST `/api/items/fetch-url-details` |
| **External Wishlists** | 1579-1694 | `/api/members/{id}/external-wishlists`, `/api/external-wishlists/{id}` |
| **Shared Wishlists** | 1713-2148 | `/api/shared-wishlists/*`, `/api/shared-wishlist-items/*` |
| **User Preferences** | 2190-2230 | PUT `/api/members/{id}/preferences` |
| **Authentication** | 2230-2650 | `/api/auth/login`, `/api/auth/register`, password reset, admin passphrase reset |
| **Households (Admin)** | 2606-3416 | `/api/admin/households/*` |
| **Email Admin** | 2785-2983 | `/api/admin/email/*` |
| **System Admin** | 3027-3650 | `/api/admin/system/*`, stats, logs |
| **Households (User)** | 3844-4103 | `/api/households/*`, join, leave, set active |
| **Logout/Broadcast** | 4184-4280 | POST `/api/auth/logout`, broadcast-maintenance |
| **Shopping Cart** | 4281-4459 | `/api/shopping-cart/*` |

---

## Data Model Relationships

```
FamilyMember (users)
├── 1:N → WishlistItem (personal items)
├── 1:N → Comment (authored)
├── 1:N → ExternalWishlist (Amazon, Etsy links)
├── 1:N → SharedWishlist (as creator)
├── M:N → Household (via user_household_association)
└── M:N → SharedWishlist (as owner, via shared_wishlist_owners)

Household
├── 1:1 → FamilyMember (creator)
├── M:N → FamilyMember (members)
└── 1:N → SharedWishlist

WishlistItem
├── N:1 → FamilyMember (owner)
└── 1:N → Comment

SharedWishlist
├── N:1 → FamilyMember (creator)
├── N:1 → Household (optional)
├── M:N → FamilyMember (owners)
└── 1:N → SharedWishlistItem

SharedWishlistItem
├── N:1 → SharedWishlist
├── N:1 → FamilyMember (creator)
└── 1:N → Comment

ShoppingCartItem
├── N:1 → FamilyMember (buyer)
├── N:1 → FamilyMember (recipient, optional)
├── N:1 → WishlistItem (optional link)
└── N:1 → SharedWishlistItem (optional link)

Comment → can belong to WishlistItem OR SharedWishlistItem (one nullable FK)
```

---

## Frontend Components

| Component | Purpose |
|-----------|---------|
| **DashboardScreen.jsx** | Main user view - personal wishlist, shared wishlists, shopping cart |
| **AdminPage.jsx** | Admin dashboard - users, households, email, backups, migrations, logs |
| **AuthScreen.jsx** | Login/registration with Turnstile CAPTCHA |
| **FirstTimeSetupScreen.jsx** | Initial admin setup for new installations |
| **UserSelectionScreen.jsx** | Switch between family members' wishlists |
| **FloatingActionMenu.jsx** | FAB with quick actions (add item, browse, cart, etc.) |
| **Navbar.jsx** | Top nav - profile, logout, theme toggle |
| **WishlistCard.jsx** | Individual item display with status, priority, actions |
| **AddItemForm.jsx** | Add items with URL auto-fetch |
| **SharedWishlistView.jsx** | View/manage shared wishlist items |
| **SharedWishlistManager.jsx** | Create/edit/delete shared wishlists, manage owners |
| **ShoppingCartDrawer.jsx** | Side drawer for cart management |
| **ExternalWishlistsButton.jsx** | Manage external wishlist links |
| **UserHouseholdManager.jsx** | Join/leave/switch households |
| **UserPreferencesDropdown.jsx** | Edit clothing sizes and gift preferences |
| **GiftReminder.jsx** | Upcoming event reminders |
| **EnhancedUpcomingEventsBanner.jsx** | Birthday countdown banner |

---

## Frontend Contexts

| Context | State & Purpose |
|---------|-----------------|
| **AppContext** | `isAuthenticated`, `selectedUser`, `familyMembers`, `directLogin`. Login/logout, data refresh. |
| **ThemeContext** | `darkMode` toggle, persisted to localStorage |
| **TutorialContext** | 8-step onboarding tutorial with react-joyride |

---

## API Function Categories (api.js)

| Category | Functions |
|----------|-----------|
| **Auth** | `loginUser`, `registerUser`, `requestPasswordReset`, `confirmPasswordReset`, `adminResetPassword`, `logoutUser` |
| **Family Members** | `getFamilyMembers`, `createFamilyMember`, `updateFamilyMember`, `deleteFamilyMember` |
| **Wishlist Items** | `getWishlistItems`, `createWishlistItem`, `updateWishlistItem`, `deleteWishlistItem`, `toggleThinkingAbout`, `markPurchased` |
| **Comments** | `addComment`, `deleteComment` |
| **Shared Wishlists** | `getSharedWishlists`, `createSharedWishlist`, `updateSharedWishlist`, `deleteSharedWishlist`, `addSharedWishlistOwner`, `removeSharedWishlistOwner` |
| **Shared Items** | `getSharedWishlistItems`, `createSharedWishlistItem`, `updateSharedWishlistItem`, `deleteSharedWishlistItem`, `toggleSharedItemThinking`, `toggleSharedItemPurchased` |
| **Shopping Cart** | `getShoppingCartItems`, `createShoppingCartItem`, `addShoppingCartItemFromWishlistItem`, `addShoppingCartItemFromSharedWishlistItem`, `updateShoppingCartItem`, `deleteShoppingCartItem` |
| **Households** | `getHouseholds`, `createHousehold`, `joinHousehold`, `leaveHousehold`, `setActiveHousehold` |
| **External Wishlists** | `getExternalWishlists`, `createExternalWishlist`, `updateExternalWishlist`, `deleteExternalWishlist` |
| **Admin** | Migrations, backups, email settings, system stats, logs, `getRecoveryPassphrase`, `regenerateRecoveryPassphrase` |

---

## API URL Patterns

```
/api/family-members/{member_id}
/api/members/{owner_id}/items
/api/items/{item_id}
/api/items/{item_id}/toggle-thinking
/api/items/{item_id}/toggle-purchased
/api/items/{item_id}/comments
/api/shared-wishlists/{wishlist_id}
/api/shared-wishlists/{wishlist_id}/items
/api/shared-wishlists/{wishlist_id}/owners
/api/shared-wishlist-items/{item_id}
/api/shopping-cart/{cart_item_id}
/api/households/{household_id}
/api/admin/households/{household_id}/members
/api/admin/migrations/*
/api/admin/backups/*
/api/admin/email/*
/api/admin/system/*
/api/admin/recovery-passphrase
/api/admin/recovery-passphrase/regenerate
/api/auth/admin-reset-password
```

---

## Recent Development Context

**Current branch**: `claude/shared-kid-wishlist-1AoU8`

**Recent features added**:
- Shared kid wishlists with multi-owner support
- Household management (switching, joining, leaving)
- Shopping cart linking to wishlist items (optimistic updates)
- Enhanced floating action menu with tabs

**Files recently modified**:
- `FloatingActionMenu.jsx` (currently has uncommitted changes)
- `SharedWishlistView.jsx`, `SharedWishlistManager.jsx`
- `ShoppingCartDrawer.jsx`
- Backend shared wishlist routes (lines 1713-2148)

---

## Token-Efficient Practices

### Use This File First
Before searching the codebase:
1. Check the **Backend Route Map** for API route locations
2. Check **Frontend Components** for which file handles a feature
3. Check **Data Model Relationships** before reading models.py

### Use MCP Tools Strategically
- **Playwright MCP**: Browser automation, screenshots, form testing
- **GitHub MCP**: Issue tracking, PRs, code search
- **Exa MCP**: Web searches and code context (`get_code_context_exa`)
- **Context7 MCP**: Library documentation (`resolve-library-id` then `query-docs`)

### Reduce Context Waste
- **Use the Explore agent** for open-ended questions instead of multiple grep/glob calls
- **Read specific files** rather than broad searches when you know what you need
- **Don't re-read files** you've already read in the conversation
- **Use glob patterns** efficiently (e.g., `**/*.jsx` instead of multiple searches)

---

## Common Tasks

### Adding a New API Endpoint
1. Add Pydantic schemas in `backend/app/schemas.py`
2. Add CRUD operations in `backend/app/crud.py` if needed
3. Add the route in `backend/app/main.py` (note the line number in this file!)
4. Update frontend `services/api.js` to call the new endpoint
5. Test the endpoint via `/docs` (Swagger UI)
6. **Update the Backend Route Map section above**

### Adding a New Frontend Component
1. Create component in `frontend/src/components/`
2. Use existing patterns from similar components
3. Leverage `AppContext` for global state access
4. Follow TailwindCSS conventions for styling
5. **Update the Frontend Components table above**

### Database Changes
1. Modify models in `backend/app/models.py`
2. Create an Alembic migration in `backend/migrations/`
3. Test migration up/down
4. Update related schemas and CRUD operations
5. **Update the Data Model Relationships section above**

---

## Environment & Running Locally

```bash
# Install all dependencies
npm run install:all

# Run development (frontend + backend concurrently)
npm run dev

# Or run separately
npm run dev:frontend  # Vite dev server on :5173
npm run dev:backend   # Uvicorn with reload on :8000

# Docker
npm run docker:local
```

### Key Environment Variables
- `VITE_API_BASE_URL`: Frontend API base URL
- `DATABASE_URL`: SQLite database path
- `FAMILY_MEMBERS_CONFIG`: Member config format `Name:YYYY-MM-DD,Admin:admin`

---

## Testing Changes

- Backend API: Use Swagger UI at `http://localhost:8000/docs`
- Frontend: Verify in browser, check console for errors
- Database: Check SQLite file or use migrations

---

## What to Avoid

- Don't modify `main.py` without checking the route map first (it's large)
- Don't change database models without considering migration impact
- Don't add new dependencies without justification
- Don't refactor working code unless explicitly asked
- Don't add comments, docstrings, or type hints to code you didn't change
- Don't create new files when editing existing ones would suffice
