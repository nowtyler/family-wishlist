# Family Wishlist Application

A full-stack web application that helps families manage gift wishlists and coordinate gift-giving.

## Features

### Authentication & User Management
- Individual user accounts with username/password authentication
- Password reset functionality via email with secure token-based recovery
- Direct login to user's own wishlist
- Admin user with special privileges and recovery passphrase access
- Rate limiting and brute force protection on authentication endpoints
- Turnstile CAPTCHA integration for bot prevention

### Wishlist Management
- **Personal Wishlists**: Create, edit, and delete wishlist items with:
  - Title and description (supports longer titles up to 500 characters)
  - Price (stored in cents for precision)
  - Priority levels (Low, Medium, High)
  - External product links (Amazon, Etsy, etc.)
  - Image URLs
- **URL Auto-Import**: Fetch item details automatically by pasting product URLs
- **Shared Wishlists**: Multi-owner wishlists for family gifts, joint purchases, and kids' wishlists
- **External Wishlist Links**: Store links to Amazon, Etsy, and other wishlist services
- Sort items by priority and recency
- Bulk delete operations (personal list or all lists as admin)
- Export/Import wishlist items to/from JSON files

### Gift Coordination
- **Shopping Cart**: Track items you plan to purchase with recipient tracking
- **Status Tracking**: Mark items as "thinking about purchasing" or "purchased"
- Hide purchased items from wishlist owners
- Show purchase status to other family members
- Comment on items (except your own) to coordinate gift-giving
- Link shopping cart items to personal or shared wishlists

### Family Organization
- **Households**: Group family members together (e.g., separate households for different branches)
- Join, leave, or switch active households
- Shared wishlists auto-appear in households where owners are members
- Invite household members to view shared wishlists

### Smart Features
- **Gift Event Reminders**: Upcoming birthdays and holiday reminders with dynamic countdown banners
- **Dark/Light Theme**: Full theme support with automatic dark mode detection
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **User Preferences**: Track family member size/preferences for easier gift buying
- **Interactive Tutorial**: Guided onboarding for first-time users (can be replayed anytime)
- **Database Backups**: Automatic and manual backup creation with restore functionality
- **System Logs**: Admin dashboard with system logs and statistics

### Admin Features
- Manage family members and their accounts
- View system statistics and logs
- Create and restore database backups
- Handle database migrations
- Manage email settings and templates
- Emergency admin access via recovery passphrase
- Broadcast system notifications and maintenance messages

## Technical Details

### Environment Setup
1. Copy `.env.example` to `.env` and update with your configuration:
```env
# Environment: "production" or "development"
ENVIRONMENT=production

# Database configuration
DATABASE_URL="sqlite:///./data/wishlist.db"

# Family members (optional - can be configured via admin interface)
FAMILY_MEMBERS_CONFIG="Name1:YYYY-MM-DD,Name2:YYYY-MM-DD,Admin:admin"

# Holiday dates
CHRISTMAS_MONTH=12
CHRISTMAS_DAY=25

# Email configuration (for password reset)
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASSWORD=your_app_password

# Cloudflare Turnstile CAPTCHA (optional, skipped in development)
SITE_KEY=your_turnstile_site_key
SECRET_KEY=your_turnstile_secret_key

# Password reset URL (update with your domain)
BASE_URL=https://your-domain.com
```

2. See `.env.example` for additional optional configuration options.

### Installation Options

#### Option 1: Using Docker (Recommended)

You can build Docker images locally or use pre-built images from a Docker registry.

1. **Building images locally** (recommended for first-time setup):

```bash
# Clone the repository
git clone https://github.com/your-username/family-wishlist.git
cd family-wishlist

# Create your .env file with the required variables
cp .env.example .env
# Edit .env with your configurations

# Build and run with Docker Compose
docker-compose -f docker-compose.local.yml up -d
```

2. **Using pre-built images from a Docker registry** (if you have published images):

```bash
# Create a directory for your wishlist application
mkdir family-wishlist && cd family-wishlist

# Download a docker-compose file
curl -O https://raw.githubusercontent.com/your-username/family-wishlist/main/docker-compose.prod.yml

# Create your .env file
cp .env.example .env
# Edit .env with your configurations

# Start the containers
docker-compose -f docker-compose.prod.yml up -d
```

#### Option 2: Manual Development Setup

1. Backend Setup (Python/FastAPI):
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

2. Frontend Setup (React/Vite):
```bash
cd frontend
npm install
npm run dev
```

3. Node.js Setup (for advanced product scraping):
```bash
# Install Node.js (if not already installed)
# Visit https://nodejs.org/ for installation instructions

# Install required Node.js packages
cd backend/app/services/browser_scripts
npm install
```

### API Documentation
- Access the interactive API documentation at `/docs` or `/redoc`
- All endpoints are prefixed with `/api`
- Rate limiting: 60 requests per minute per IP

### Security Features
- Password-based authentication with brute force protection
- Input validation for all forms
- XSS protection through input sanitization
- CORS configuration for security
- Rate limiting to prevent abuse

### Database Management
- The application automatically creates the required database structure on first run
- Database migrations are handled through schema version tracking
- Admin users can manage database backups and restore
- Emergency admin access is available if the database becomes corrupted
- Schema changes are tracked with hash validation for reliable upgrades

## Usage Guide

1. **Initial Access**
   - Access the application through the browser
   - Enter the family password
   - Select your user identity

2. **Managing Your Wishlist**
   - Add items using the floating "+" button
   - Edit/delete items using item controls
   - Set priority levels to indicate importance
   - Add links and images for better item identification

3. **Gift Coordination**
   - View others' wishlists
   - Use "thinking about" to indicate interest
   - Mark items as purchased
   - Add comments to discuss items
   - Purchased items are hidden from the owner

4. **Admin Features**
   - Access with the admin user
   - Clear all wishlists
   - Update system version
   - Manage family member data
   - Handle database backups and migrations
   - Use emergency access if database is corrupted

## Best Practices

1. **Adding Items**
   - Provide clear titles and descriptions
   - Include accurate prices when possible
   - Add links to specific products
   - Set appropriate priority levels

2. **Gift Coordination**
   - Mark "thinking about" before purchasing
   - Comment to coordinate with others
   - Mark purchases promptly
   - Check upcoming events regularly

## Technical Stack

- **Frontend**: React, Vite, TailwindCSS, Framer Motion
- **Backend**: Python, FastAPI, SQLAlchemy
- **Database**: SQLite
- **Authentication**: Custom password system with rate limiting

## Docker Images

This application can be containerized and deployed using Docker. To create Docker images:

```bash
# Build frontend image
docker build -t family-wishlist:frontend ./frontend

# Build backend image
docker build -t family-wishlist:backend ./backend
```

You can also push these to your own Docker registry:

```bash
# Log in to your Docker registry
docker login

# Tag and push frontend image
docker tag family-wishlist:frontend your-registry/family-wishlist:frontend
docker push your-registry/family-wishlist:frontend

# Tag and push backend image
docker tag family-wishlist:backend your-registry/family-wishlist:backend
docker push your-registry/family-wishlist:backend
```

## Deployment Examples

### Simple Docker Deployment

```bash
# Create a directory for your wishlist application
mkdir family-wishlist && cd family-wishlist

# Clone or download the docker-compose file
git clone https://github.com/your-username/family-wishlist.git
cd family-wishlist

# Create your .env file
cp .env.example .env
# Edit .env with your configuration

# Build images (optional if using pre-built images)
docker-compose build

# Start the containers
docker-compose -f docker-compose.local.yml up -d
```

Access the application at `http://localhost:5173` (frontend) and `http://localhost:8000` (API).

### Using Docker with Traefik for SSL

```yaml
version: '3.8'

services:
  backend:
    image: family-wishlist:backend
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_URL=sqlite:///./data/wishlist.db
      - ENVIRONMENT=production
      - BASE_URL=https://wishlist.your-domain.com
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.wishlist-api.rule=Host(`wishlist.your-domain.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.wishlist-api.tls=true"
      - "traefik.http.routers.wishlist-api.tls.certresolver=letsencrypt"
    restart: unless-stopped
    
  frontend:
    image: family-wishlist:frontend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.wishlist.rule=Host(`wishlist.your-domain.com`)"
      - "traefik.http.routers.wishlist.tls=true"
      - "traefik.http.routers.wishlist.tls.certresolver=letsencrypt"
    depends_on:
      - backend
    restart: unless-stopped

networks:
  default:
    external:
      name: traefik-network
```

**Note**: Replace `your-domain.com` with your actual domain and replace image names with your built/pushed images.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request with a clear description

## Support

For issues or questions:
1. Check the API documentation
2. Review the browser console for errors
3. Contact the system administrator

## License

This project is provided as-is. See LICENSE file for details.

For questions or issues, please open an issue on GitHub or contact the maintainers.

## Local Development Workflow

1. Clone the repository
```bash
git clone https://github.com/your-username/family-wishlist.git
cd family-wishlist
```

2. Set up your environment
```bash
cp .env.example .env
# Edit .env with your configurations
# At minimum, set:
# - ENVIRONMENT=development
# - BASE_URL=http://localhost:5173
# - SMTP settings for email (or leave blank to skip password reset in dev)
```

3. Install dependencies
```bash
npm run install:all
```

4. Start development servers
```bash
npm run dev
```
This runs backend (port 8001) and frontend (port 5173) concurrently.

5. Make changes to the code
   - Backend changes in `./backend/app/`
   - Frontend changes in `./frontend/src/`

6. Database migrations (if needed)
```bash
cd backend && ./venv/bin/alembic upgrade head
```

## Development vs Production Environments

This application can run both production and development environments with separate databases.

### Production
To run the production environment:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Development
To run the development environment:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

Both environments use:
- Separate container names
- Separate data directories
- Different port configurations
- Isolated networks

This allows you to test new features in development without affecting production data.
