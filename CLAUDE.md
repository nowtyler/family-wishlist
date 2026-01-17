# Claude Code Guidelines for Family Wishlist

## About This Application

Family Wishlist is a full-stack web application for coordinating gift-giving among family members. Users can create personal wishlists, browse others' wishlists, mark items as "thinking about purchasing" or "purchased," and coordinate through comments and status tracking. The goal is to prevent duplicate purchases and facilitate thoughtful gift-giving for holidays, birthdays, and special occasions.

### Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, TailwindCSS, Framer Motion, React Router v6
- **Backend**: FastAPI (Python), SQLAlchemy ORM, Pydantic validation
- **Database**: SQLite
- **Deployment**: Docker, Docker Compose, Nginx, Traefik

### Key Features
- User authentication with password reset via email
- Wishlist CRUD with priority levels, prices, images, and external links
- Gift coordination (mark as "thinking about" or "purchased")
- URL auto-import for product details
- Dark/light theme support
- Admin dashboard for family member management, backups, and migrations
- Gift event reminders (birthdays, Christmas)

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

### Code Structure Awareness
```
backend/
├── app/
│   ├── main.py          # FastAPI app, routes (~3,800 lines - be careful here)
│   ├── models.py        # SQLAlchemy models
│   ├── schemas.py       # Pydantic schemas
│   ├── crud.py          # Database operations
│   ├── services/        # Business logic (email, scraping, backups, auth)
│   └── middleware/      # Rate limiting

frontend/
├── src/
│   ├── components/      # React components (AdminPage, DashboardScreen, etc.)
│   ├── contexts/        # AppContext (global state), ThemeContext
│   ├── services/api.js  # Axios API client
│   └── utils/           # Helper functions
```

## Token-Efficient Practices

### Use MCP Tools Strategically
You have access to powerful MCP servers. Use them:
- **Puppeteer MCP**: For browser automation, screenshots, form filling, and web scraping
  - `puppeteer_navigate`: Navigate to URLs
  - `puppeteer_screenshot`: Capture screenshots
  - `puppeteer_click`, `puppeteer_fill`, `puppeteer_select`: Interact with elements
  - `puppeteer_evaluate`: Execute JavaScript in browser
- **GitHub MCP**: For issue tracking, PRs, code search across GitHub
- **Exa MCP**: For web searches and code context (`get_code_context_exa` for library docs)
- **Context7 MCP**: For up-to-date library documentation (`resolve-library-id` then `query-docs`)
- **n8n MCP**: For workflow automation if needed

### Reduce Context Waste
- **Use the Explore agent** for open-ended codebase questions instead of multiple grep/glob calls
- **Read specific files** rather than broad searches when you know what you need
- **Don't re-read files** you've already read in the conversation
- **Batch related operations** when possible
- **Use glob patterns** efficiently (e.g., `**/*.tsx` instead of multiple searches)

### Efficient Search Patterns
```
# Good: Targeted search
Grep for "def create_wishlist_item" in backend/app/

# Avoid: Broad searches that return too much
Grep for "item" across entire codebase
```

## Common Tasks

### Adding a New API Endpoint
1. Add Pydantic schemas in `backend/app/schemas.py`
2. Add CRUD operations in `backend/app/crud.py` if needed
3. Add the route in `backend/app/main.py`
4. Update frontend `services/api.js` to call the new endpoint
5. Test the endpoint via `/docs` (Swagger UI)

### Adding a New Frontend Component
1. Create component in `frontend/src/components/`
2. Use existing patterns from similar components
3. Leverage `AppContext` for global state access
4. Follow TailwindCSS conventions for styling

### Database Changes
1. Modify models in `backend/app/models.py`
2. Create an Alembic migration in `backend/migrations/`
3. Test migration up/down
4. Update related schemas and CRUD operations

## Environment & Running Locally

```bash
# Install all dependencies
npm run install:all

# Run development (frontend + backend concurrently)
npm run dev

# Or run separately
npm run dev:frontend  # Vite dev server
npm run dev:backend   # Uvicorn with reload

# Docker
npm run docker:local
```

### Key Environment Variables
- `VITE_API_BASE_URL`: Frontend API base URL
- `DATABASE_URL`: SQLite database path
- `FAMILY_MEMBERS_CONFIG`: Member config format `Name:YYYY-MM-DD,Admin:admin`

## Testing Changes

- Backend API: Use Swagger UI at `http://localhost:8000/docs`
- Frontend: Verify in browser, check console for errors
- Database: Check SQLite file or use migrations

## What to Avoid

- Don't modify `main.py` without reading relevant sections first (it's large)
- Don't change database models without considering migration impact
- Don't add new dependencies without justification
- Don't refactor working code unless explicitly asked
- Don't add comments, docstrings, or type hints to code you didn't change
- Don't create new files when editing existing ones would suffice
