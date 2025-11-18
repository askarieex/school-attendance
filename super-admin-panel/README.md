# Super Admin Panel - School Attendance System

Professional admin interface for managing the entire school attendance SaaS platform.

## 🎯 What is This?

This is the **Super Admin Panel** - your control center as the platform owner. From here, you can:

- ✅ **Manage all schools** (create, edit, deactivate)
- ✅ **Register RFID devices** (generate API keys/serial numbers)
- ✅ **Monitor platform statistics** (schools, students, devices)
- ✅ **Manage admin users** (create school admins)
- ✅ **View system health** (device status, connectivity)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd super-admin-panel
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your backend URL:
```
REACT_APP_API_URL=http://localhost:5001/api/v1
```

### 3. Start the Backend First

Make sure your backend is running on `http://localhost:5001`

```bash
cd ../backend
npm run dev
```

### 4. Start the Super Admin Panel

```bash
npm start
```

The app will open at `http://localhost:3000`

## 🔐 Default Login

You need to create a super admin user in the database first:

```sql
-- Connect to your database
psql -U postgres -d school_attendance

-- Insert super admin (password: admin123)
INSERT INTO users (email, password_hash, role, full_name)
VALUES (
  'superadmin@example.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqBk0yBJ3G',
  'superadmin',
  'Super Administrator'
);
```

Then login with:
- **Email:** superadmin@example.com
- **Password:** admin123

## 📚 Features

### Dashboard
- Platform overview with key metrics
- Total schools, students, devices
- Quick actions for common tasks

### Schools Management
- View all client schools
- Add new schools with admin accounts
- Edit school details (name, email, address, plan)
- Deactivate schools
- Search and filter schools

### Devices Management
- Register RFID hardware devices
- Generate unique API keys (Serial Numbers)
- Link devices to specific schools
- View device status and last seen time
- Copy API keys to clipboard
- Deactivate/revoke devices

### Users Management
- Create school admin accounts
- Assign admins to schools
- Manage user permissions
- View login history

### Statistics
- Platform-wide analytics
- Revenue tracking
- Usage trends
- System health monitoring

## 🎨 UI Features

- **Modern Design:** Clean, professional interface
- **Responsive:** Works on desktop, tablet, and mobile
- **Dark Sidebar:** Easy navigation
- **Real-time Updates:** Live data refresh
- **Secure:** Enterprise-grade authentication
- **User-Friendly:** Intuitive workflows

## 🔧 Tech Stack

- **React 18** - UI framework
- **React Router** - Navigation
- **Axios** - API calls
- **React Icons** - Beautiful icons
- **Context API** - State management
- **CSS3** - Custom styling

## 📦 Project Structure

```
super-admin-panel/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Layout.js          # Main layout with sidebar
│   │   ├── Layout.css
│   │   └── PrivateRoute.js    # Protected route wrapper
│   ├── contexts/
│   │   └── AuthContext.js     # Authentication context
│   ├── pages/
│   │   ├── Login.js           # Secure login page
│   │   ├── Login.css
│   │   ├── Dashboard.js       # Main dashboard
│   │   ├── Schools.js         # Schools management
│   │   └── Devices.js         # Devices management
│   ├── services/
│   ├── utils/
│   │   └── api.js             # API integration
│   ├── styles/
│   │   └── index.css          # Global styles
│   ├── App.js                 # Main app with routing
│   └── index.js               # Entry point
├── package.json
└── README.md
```

## 🔒 Security Features

- **JWT Authentication:** Secure token-based auth
- **Role Validation:** Only super admins can access
- **API Key Generation:** UUID-based device keys
- **Encrypted Communication:** HTTPS in production
- **Session Management:** Auto-logout on token expiry
- **Audit Logging:** All actions logged (backend)

## 📱 Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Secure login page |
| `/dashboard` | Dashboard | Platform overview |
| `/schools` | Schools | Manage client schools |
| `/devices` | Devices | Hardware management |
| `/users` | Users | Admin users management |
| `/statistics` | Statistics | Platform analytics |
| `/settings` | Settings | System configuration |

## 🎯 How to Use

### Adding a New School

1. Go to **Schools** page
2. Click **"Add School"**
3. Fill in school details:
   - Name, email, phone, address
   - Select plan (Trial/Basic/Professional/Enterprise)
   - Optional: Create admin account
4. Click **"Create School"**
5. School is now active!

### Registering a Device

1. Go to **Devices** page
2. Click **"Register Device"**
3. Select school from dropdown
4. Enter device name (e.g., "Main Entrance Scanner")
5. Enter location (e.g., "Building A - Ground Floor")
6. Click **"Generate API Key"**
7. **Copy the API key** and save securely
8. Install this key on your RFID hardware

### Managing Users

1. Go to **Users** page
2. Create new admin accounts
3. Assign them to specific schools
4. Set permissions and roles

## 🚨 Important Notes

### API Key Security

⚠️ **CRITICAL:** When you generate a device API key:
1. The key is shown **only once**
2. Copy it immediately
3. Store it securely
4. Configure it on your RFID hardware
5. Never share it publicly

### Device Configuration

After generating an API key, configure your RFID device:

```python
# In your device code
DEVICE_API_KEY = "generated-uuid-here"
SERVER_URL = "https://your-server.com/api/v1"

# Use this key in X-API-Key header
headers = {
    "X-API-Key": DEVICE_API_KEY
}
```

## 🐛 Troubleshooting

### "Network Error" on Login

- Make sure backend is running on port 5000
- Check `REACT_APP_API_URL` in `.env`
- Verify CORS is enabled in backend

### "Access Denied" After Login

- User must have `role = 'superadmin'` in database
- Check JWT token in localStorage
- Clear browser cache and try again

### Cannot Add School

- Check backend console for errors
- Verify database connection
- Ensure school email is unique

## 📈 Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] Email notifications
- [ ] Advanced analytics charts
- [ ] CSV export for all data
- [ ] Bulk device registration
- [ ] White-label customization
- [ ] Mobile app for admins

## 🔄 Updates & Deployment

### Development

```bash
npm start
```

### Production Build

```bash
npm run build
```

Uploads the `build/` folder to your hosting (Netlify, Vercel, AWS S3, etc.)

### Environment Variables for Production

```
REACT_APP_API_URL=https://your-production-api.com/api/v1
```

## 📞 Support

For issues or questions:
1. Check backend logs
2. Verify database connection
3. Review API responses in browser console
4. Check network tab in DevTools

## 📄 License

Proprietary - Internal use only

---

**Built with ❤️ for School Attendance SaaS Platform**
