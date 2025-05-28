# Family Wishlist Application

A full-stack web application that helps families manage gift wishlists and coordinate gift-giving.

## Features

### Authentication & User Management
- Single shared family password for access
- Individual user selection after authentication
- Admin user with special privileges
- Rate limiting and brute force protection

### Wishlist Management
- Create, edit, and delete wishlist items
- Add item details:
  - Title and description (supports longer titles up to 500 characters)
  - Price (stored in cents for precision)
  - Priority levels (Low, Medium, High)
  - External links to items
  - Image URLs
- URL Auto-Import: Fetch item details by pasting a product URL
- External Wishlist Integration:
  - Import from Amazon wishlists (supports multi-page wishlists with up to 1000+ items)
  - Import from Etsy lists/registries
  - Sync with external wishlists (add new/remove missing items)
- Sort items by priority and recency
- Bulk delete operations (personal list or all lists as admin)

### Gift Coordination
- Mark items as "thinking about purchasing"
- Purchase status tracking
- Hide purchased items from wishlist owners
- Show purchase status to other family members
- Comment on items (except your own)

### Smart Features
- Gift event reminders (birthdays and Christmas)
- Dynamic countdown for upcoming events
- Dark/Light theme support
- Responsive design for all devices

## Technical Details

### Environment Setup
1. Create a `.env` file with required configurations:
```env
FAMILY_PASSWORD_HASH='your_bcrypt_hash'
DATABASE_URL="sqlite:///./data/wishlist.db"
FAMILY_MEMBERS_CONFIG="Name1:YYYY-MM-DD,Name2:YYYY-MM-DD,Admin:admin"
CHRISTMAS_MONTH=12
CHRISTMAS_DAY=25
```

### Installation

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

Private use only. All rights reserved.
