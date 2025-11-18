# School Attendance App - User Guide

## 🎯 Overview
A beautiful, clean Flutter app for school attendance management with separate interfaces for Parents and Teachers.

## 🚀 Quick Start

### Run the App
```bash
cd /Users/askerymalik/Documents/School-attendance-app
flutter run
```

For specific devices:
```bash
flutter run -d chrome      # Run on Chrome
flutter run -d macos       # Run on macOS
flutter devices            # List all available devices
```

## 📱 App Features

### Welcome Screen
- Clean landing page with two login options
- **Parent Login** - For parents/guardians to track their child
- **Teacher Login** - For teachers to manage classroom attendance

### 👨‍👩‍👧 Parent Features

#### Login
- Navigate to Parent Login from welcome screen
- **Demo Mode**: Enter any email and password to login
- Example: `parent@school.com` / `password123`

#### Dashboard
- **Live Child Status**: See real-time attendance status
  - ✅ Present at School (with arrival time)
  - 🟡 Late Arrival
  - 🔴 Absent Today
- **Recent Notifications**: View arrival confirmations and alerts
- **Quick Actions**:
  - View Attendance History
  - Request Absence

#### Attendance History
- Interactive calendar view
- Statistics showing Present/Late/Absent counts
- Recent attendance records list
- Date-wise attendance tracking

#### Request Absence
- Select future date for absence
- Choose Full Day or Half Day
- Provide reason for absence
- Submit request to school

### 👨‍🏫 Teacher Features

#### Login
- Navigate to Teacher Login from welcome screen
- **Demo Mode**: Enter any email and password to login
- Example: `teacher@school.com` / `password123`

#### Dashboard
- **Quick Statistics**:
  - Total Classes
  - Total Students
- **My Classes Section**:
  - Real-time attendance count for each class
  - Present/Late/Absent breakdown
  - Attendance rate percentage
  - Tap any class to view roster

#### Class Roster (Most Important Feature)
- View all students in the class
- Live attendance status for each student
- **Manual Attendance Marking**:
  - Tap the 3-dot menu on any student
  - Choose: Mark Present / Mark Late / Mark Absent
  - Great for students who forgot their card!
- **Bulk Actions**:
  - Mark All Present
  - Mark All Absent
- Visual indicators for manually marked attendance

#### Broadcast Messages
- Send notifications to all parents in a class
- Select target class
- Type message
- Instant delivery to all parents

## 🎨 Design Features

### Clean & Modern UI
- **Material Design 3** with custom color scheme
- **Google Fonts** (Inter) for clean typography
- **Gradient backgrounds** for visual appeal
- **Card-based layouts** for content organization
- **Color-coded status indicators**:
  - 🟢 Green = Present
  - 🟡 Orange = Late
  - 🔴 Red = Absent

### User Experience
- Intuitive navigation
- Clear visual hierarchy
- Responsive touch targets
- Loading states for async operations
- Success/error feedback
- Smooth transitions

## 📊 Demo Data

The app includes sample data for demonstration:

### Demo Students (Grade 5A)
- Emma Wilson (Parent's child) - Present
- Liam Brown - Late
- Olivia Davis - Absent
- And 7 more students...

### Demo Classes
- Grade 5A - 10 students
- Grade 6B - 2 students

## 🔧 Technical Stack

- **Framework**: Flutter 3.x
- **State Management**: Provider
- **UI Fonts**: Google Fonts
- **Date Handling**: intl package
- **Calendar**: table_calendar
- **Notifications**: flutter_local_notifications

## 📁 Project Structure

```
lib/
├── main.dart                           # App entry point
├── models/                             # Data models
│   ├── user.dart                       # User model
│   ├── student.dart                    # Student model
│   ├── attendance_record.dart          # Attendance model
│   └── class_info.dart                 # Class model
├── providers/                          # State management
│   ├── auth_provider.dart              # Authentication
│   └── attendance_provider.dart        # Attendance data
└── screens/                            # UI screens
    ├── welcome_screen.dart             # Landing page
    ├── parent_login_screen.dart        # Parent login
    ├── teacher_login_screen.dart       # Teacher login
    ├── parent_dashboard.dart           # Parent main screen
    ├── teacher_dashboard.dart          # Teacher main screen
    ├── class_roster_screen.dart        # Student list & manual marking
    ├── attendance_history_screen.dart  # Calendar & history
    └── request_absence_screen.dart     # Absence request form
```

## 🔐 Authentication

**Current Implementation**: Demo mode for testing
- Any email/password combination works
- Separate login flows for Parent and Teacher
- Role-based navigation after login

**Production Ready**: Replace with:
- Firebase Authentication
- Custom backend API
- OAuth providers

## 📈 Next Steps for Production

1. **Backend Integration**
   - Replace demo data with real API calls
   - Implement authentication service
   - Add database integration

2. **Real-time Updates**
   - WebSocket for live attendance
   - Push notifications for parents
   - Auto-refresh capabilities

3. **Additional Features**
   - Multiple children per parent
   - Teacher schedule management
   - Detailed reports and analytics
   - Export attendance data

4. **Platform Optimization**
   - iOS specific styling
   - Android Material theming
   - Tablet/iPad layouts
   - Accessibility improvements

## 🎯 Key Highlights

✅ **Two separate login screens** as requested
✅ **Clean, beautiful, simple UI** with modern design
✅ **Parent peace of mind** with live status and notifications
✅ **Teacher classroom control** with manual attendance marking
✅ **Instant feedback** with real-time updates
✅ **Professional design** suitable for school environment

## 🐛 Testing

Run on different platforms:
```bash
flutter run -d ios          # iPhone simulator
flutter run -d android      # Android emulator
flutter run -d chrome       # Web browser
flutter run -d macos        # macOS desktop
```

## 💡 Usage Tips

1. **For Testing**: Use any credentials to login
2. **Parent View**: Check "Emma Wilson" for demo data
3. **Teacher View**: Navigate to "Grade 5A" to see all features
4. **Manual Marking**: Use the 3-dot menu on student cards
5. **Broadcast**: Try sending a message to a class

---

**Built with Flutter** ❤️ for modern school attendance management
