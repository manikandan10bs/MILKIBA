# MILKIBA 🥛

> **Smart Milk Marketplace & Dairy Distribution Management System**  
> Connecting Dairy Farmers (Sellers), Distributors (Vendors), and Consumers (Buyers) in a unified, real-time platform.

---

## 📌 Overview

**MILKIBA** is a full-featured web application designed to streamline daily milk collection, distribution, financial records, and operational notifications. Built on top of Firebase Realtime Database and Firebase Authentication, the platform delivers role-based access for sellers, buyers, vendors, and administrators.

Whether managing daily morning/evening milk yields, distributing milk to neighborhood households, or settling payments, MILKIBA ensures data integrity with strict server-side validation rules and transparent transaction auditing.

---

## 🌟 Key Features

### 1. 🐄 Seller (Dairy Farmer) Portal
- **Daily Availability Submission**: Toggle morning or evening sessions to notify vendors about milk availability and estimated yield in liters.
- **Collection History**: Real-time log of milk collected by vendors, including quantity, fat/quality grading, rate per liter, and payment statuses (Paid / Partial / Not Paid).
- **Change Request Approval**: Receive and review change or deletion requests initiated by vendors before records are modified.

### 2. 🥛 Buyer (Consumer) Portal
- **Daily Requirement Notification**: Specify morning or evening milk requirements and desired volume (in liters).
- **Supply Tracking**: Access detailed supply records showing delivered volume, calculated billing, and balance dues.
- **Adjustment Transparency**: Review adjustment requests for deliveries or payments with full reason transparency.

### 3. 🚚 Vendor (Distributor) Dashboard
- **Live Notifications Feed**: Monitor sellers who have milk ready for pickup and buyers awaiting delivery for the active session (morning/evening).
- **Collection Logging**: Record seller collections with quality notes, pricing calculations, actual quantities, and immediate or pending payout tracking.
- **Supply Dispatching**: Record deliveries to buyers with automated rate multiplication and payment bookkeeping.
- **Audit & Governance**: Two-party verification mechanism—vendors submit edit or deletion requests for recorded transactions, requiring target user consent.

### 4. 🛡️ Admin & Security Controls
- **Google OAuth Admin Panel**: Secured administrator interface restricted to authorized administrative emails.
- **Password Reset Requests**: Pipeline to inspect and review password assistance requests submitted by platform users.
- **Strict Realtime Database Rules**: Granular role-based security protecting user profiles, financial ledgers, and notification queues from unauthorized read or write operations.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: HTML5, CSS3, Bootstrap 5, Modern ES6+ JavaScript Modules
- **Authentication**: Firebase Authentication (Email/Password & Google Provider)
- **Database**: Firebase Realtime Database
- **Hosting**: Firebase Hosting (CDN-backed static asset delivery with clean URLs)
- **Tooling**: Firebase CLI, Node.js

---

## 📂 Project Structure

```text
MILKIBA/
├── .firebaserc                # Firebase project configuration (milkiba-18)
├── .gitignore                 # Git ignore rules for node_modules, cache, venv
├── database.rules.json        # Realtime Database security and validation rules
├── firebase.json              # Hosting configuration and rewrites
├── README.md                  # Project documentation
└── public/                    # Web application root
    ├── index.html             # Homepage / Landing page
    ├── login.html             # Authentication & Sign-in
    ├── register.html          # New user registration with role assignment
    ├── buyer.html             # Buyer dashboard
    ├── seller.html            # Seller / Farmer dashboard
    ├── vendor.html            # Vendor operations dashboard
    ├── admin.html             # Administrator console
    ├── about.html             # About MILKIBA
    ├── contact.html           # Contact and support information
    ├── passwordReset.html     # Password assistance request form
    ├── assets/                # Media assets (milk-video.mp4, icons, images)
    ├── css/                   # Stylesheets
    │   ├── style.css          # Homepage styles
    │   ├── auth.css           # Authentication pages styling
    │   ├── login.css          # Login page layout
    │   ├── buyer.css          # Buyer portal styling
    │   ├── seller.css         # Seller portal styling
    │   └── vendor.css         # Vendor portal styling
    └── js/                    # ES6 Modules
        ├── firebase-config.js # Firebase app initialization & service exports
        ├── auth.js            # User registration logic
        ├── login.js           # Login & role-based routing
        ├── buyer.js           # Buyer session actions & history
        ├── seller.js          # Seller session actions & history
        ├── vendor.js          # Vendor collection, supply & request management
        ├── admin.js           # Admin authentication & review handler
        └── passwordReset.js   # Password reset request handler
```

---

## 📊 Database Schema Summary

| Path | Description | Access Control |
|---|---|---|
| `/users/{uid}` | User profiles (name, email, role, createdAt) | Read: Self or Vendor; Write: Self |
| `/sellerNotifications/{id}` | Seller daily availability per session | Read: Vendor, Seller; Write: Vendor or Owner |
| `/buyerNotifications/{id}` | Buyer daily milk demands per session | Read: Vendor, Buyer; Write: Vendor or Owner |
| `/milkCollections/{id}` | Recorded collections from farmers | Read: Vendor, Seller; Write: Vendor or Owner |
| `/milkSupplies/{id}` | Recorded supplies to consumers | Read: Vendor, Buyer, Seller; Write: Vendor or Owner |
| `/changeRequests/{id}` | Transaction edit/delete requests | Read: Vendor, Buyer, Seller; Write: Vendor or Target User |
| `/passwordResetRequests/{id}`| Password reset assistance requests | Read/Write: Authorized Admin |

---

## 🚀 Getting Started & Deployment

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)

### 2. Local Testing
To preview the application locally:
```bash
# Install Firebase Tools if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Start local hosting emulator
firebase emulators:start --only hosting
```
Alternatively, open `public/index.html` via any local HTTP server (such as Python's `python -m http.server 8000` or VS Code Live Server).

### 3. Deploying to Firebase
Deploy database security rules and static hosting files:
```bash
# Deploy all (Database rules + Hosting)
firebase deploy

# Or deploy database rules only
firebase deploy --only database

# Or deploy hosting only
firebase deploy --only hosting
```

---

## 📄 License
This project is licensed under the MIT License.
