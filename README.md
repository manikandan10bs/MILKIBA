# MILKIBA 🥛

> **Smart Milk Marketplace & Dairy Distribution Platform**  
> Connecting Dairy Farmers (Sellers), Distributors (Vendors), and Consumers (Buyers) in a seamless, real-time ecosystem.

[![Live Website](https://img.shields.io/badge/Live%20Demo-milkiba--18.web.app-2e7d32?style=for-the-badge&logo=googlechrome&logoColor=white)](https://milkiba-18.web.app)
[![Firebase](https://img.shields.io/badge/Backend-Firebase%20RTDB%20%7C%20Auth-ffca28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-manikandan10bs%2FMILKIBA-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/manikandan10bs/MILKIBA)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

---

## 🌐 Live Application Links

- **Production URL**: [https://milkiba-18.web.app](https://milkiba-18.web.app)
- **Firebase Default Domain**: [https://milkiba-18.firebaseapp.com](https://milkiba-18.firebaseapp.com)
- **GitHub Repository**: [https://github.com/manikandan10bs/MILKIBA.git](https://github.com/manikandan10bs/MILKIBA.git)

---

## 📑 Table of Contents
1. [Platform Overview](#-platform-overview)
2. [Comprehensive System Analysis](#-comprehensive-system-analysis)
   - [Architectural Design & Flow](#1-architectural-design--flow)
   - [Role-Based Workflow Analysis](#2-role-based-workflow-analysis)
   - [CSS & UI/UX Engineering Analysis](#3-css--uiux-engineering-analysis)
   - [Security, Rules & Data Integrity Audit](#4-security-rules--data-integrity-audit)
   - [Performance & Optimization Audit](#5-performance--optimization-audit)
3. [Database Schema & Security Matrix](#-database-schema--security-matrix)
4. [Project Structure](#-project-structure)
5. [Getting Started & Local Testing](#-getting-started--local-testing)
6. [Firebase Deployment Guide](#-firebase-deployment-guide)
7. [License](#-license)

---

## 📌 Platform Overview

**MILKIBA** is an end-to-end dairy supply chain web application built to digitize daily milk collection and distribution. Traditionally, local dairy ecosystems rely on manual paper logbooks, subjective volume records, delayed payment reconciliation, and lack of transparency between farmers and consumers.

MILKIBA solves these problems by providing:
- **Real-Time Yield Forecasting**: Dairy farmers announce morning and evening milk availability in advance.
- **Consumer Demand Planning**: Households and commercial buyers indicate daily requirements.
- **Operational Distribution Hub**: Vendors record collections and deliveries with instant automated rate, volume, and payment calculations.
- **Two-Party Audit Trail**: Transactions cannot be secretly modified; vendors must request edits/deletions, which require approval from the affected seller or buyer.
- **Administrative Governance**: Dedicated admin controls with Google OAuth for system monitoring and password reset triage.

---

## 🔬 Comprehensive System Analysis

### 1. Architectural Design & Flow

MILKIBA operates on a **Serverless Event-Driven Architecture** leveraging native ES6 browser modules communicating directly with Firebase services.

```
 +-----------------------------------------------------------------------------------+
 |                                   USERS / CLIENTS                                 |
 |                                                                                   |
 |  +-------------------+  +-------------------+  +-------------------+  +---------+ |
 |  |  Seller (Farmer)  |  |  Buyer (Consumer) |  | Vendor (Operator) |  |  Admin  | |
 |  |    seller.html    |  |    buyer.html     |  |    vendor.html    |  |admin.html| |
 |  +---------+---------+  +---------+---------+  +---------+---------+  +----+----+ |
 +------------|----------------------|----------------------|-----------------|------+
              |                      |                      |                 |
              v                      v                      v                 v
 +-----------------------------------------------------------------------------------+
 |                              CLIENT APPLICATION LAYER                             |
 |           Vanilla JavaScript (ES6 Modules) - No Heavy Build Step Required         |
 |   [firebase-config.js] [auth.js] [login.js] [buyer.js] [seller.js] [vendor.js]    |
 +-------------------------------------+---------------------------------------------+
                                       |
                   Secure HTTPS / WSS  | (Rules & Auth Evaluated)
                                       v
 +-----------------------------------------------------------------------------------+
 |                             FIREBASE BACKEND SERVICES                             |
 |                                                                                   |
 |   +------------------------------------+  +-----------------------------------+   |
 |   |       Firebase Authentication      |  |     Firebase Realtime Database    |   |
 |   |  - Email / Password Login          |  |  - Realtime WebSocket Sync        |   |
 |   |  - Google OAuth (Admin Portal)     |  |  - Fine-grained RBAC validation   |   |
 |   +------------------------------------+  +-----------------------------------+   |
 +-----------------------------------------------------------------------------------+
```

---

### 2. Role-Based Workflow Analysis

```
  DAIRY FARMER (Seller)              VENDOR (Distributor)             CONSUMER (Buyer)
          |                                   |                               |
          |-- 1. Notify Milk Available ------>|                               |
          |      (Morning / Evening Yield)    |                               |
          |                                   |<-- 2. Notify Milk Required ---|
          |                                   |       (Morning / Evening)     |
          |                                   |                               |
          |<-- 3. Collect & Log Milk ---------|                               |
          |      (Qty, Quality, Rate, Payout) |                               |
          |                                   |-- 4. Supply Milk & Log ------>|
          |                                   |      (Delivered, Rate, Dues)  |
          |                                   |                               |
          |<-- 5. Request Edit/Delete? -------|                               |
          |       (Requires Farmer Consent)   |-- 5. Request Edit/Delete? --->|
          |                                   |      (Requires Buyer Consent) |
```

#### A. Dairy Farmer (Seller) Portal
- **Daily Availability Toggle**: Farmers choose morning or evening sessions and declare estimated milk volume.
- **Collection Ledger**: Immediate visibility into recorded collections, actual quantities collected, fat/quality notes, rate per liter, and payment statuses (`Paid`, `Partial`, `Not Paid`).
- **Mutual Verification**: Vendors cannot tamper with historical collections; any correction raises a change request that the farmer must explicitly approve or reject.

#### B. Consumer (Buyer) Portal
- **Session Requirement Selection**: Households notify the distributor whether milk is needed today and specify requested liters.
- **Supply Tracking**: Complete delivery records show quantity delivered, rate, total amount, paid amount, and pending balance.
- **Request Oversight**: If a vendor submits an adjustment to a previous supply record, the buyer reviews the explanation and approves or declines.

#### C. Vendor (Distributor) Dashboard
- **Overall Analytics & Multi-Period Reporting**:
  - **Dynamic Period Switcher**: Instantly switch between **Day Report**, **Weekly Report** (7-day rolling/calendar week), **Monthly Report** (calendar month), **Yearly Report**, and **All-Time** historical summaries.
  - **8 Real-Time Business KPIs**:
    1. *Milk Collected*: Total volume in liters and total farmer collection count.
    2. *Milk Supplied*: Total volume in liters and total buyer delivery count.
    3. *Net Stock Margin*: Exact inventory balance (+/- surplus or deficit).
    4. *Purchase Cost*: Total expense incurred from dairy farmers (with paid breakdown).
    5. *Sales Revenue*: Total revenue billed to consumers (with collected breakdown).
    6. *Gross Profit / Earnings*: Real-time margin with automated percentage badge.
    7. *Seller Dues (Payable)*: Outstanding debt owed to farmers.
    8. *Buyer Dues (Receivable)*: Outstanding money to be collected from buyers.
  - **Period Trend Breakdown Table**: Grouped summary showing inventory and margin trends across sub-periods.
  - **Itemized Ledger Tables**: Tabbed inspection of all individual collections and supplies within the selected period.
- **Comprehensive Multi-File PDF Export Engine**:
  - Powered by `jsPDF` and `jspdf-autotable` directly in the browser (zero server load).
  - **📄 Download Full Audit Report (PDF)**: High-resolution multi-page document featuring official branding, metadata, executive KPI cards, itemized collection ledgers with footer totals, itemized supply ledgers with footer totals, and page numbering.
  - **🥛 Download Collections PDF**: Dedicated ledger of all collection entries in the period.
  - **🚚 Download Supplies PDF**: Dedicated ledger of all supply distributions in the period.
  - **Individual Transaction Slips**: Export single-receipt PDF slips for individual farmer collections or buyer deliveries on demand.
- **Daily Operations Queue**: Real-time morning/evening queues for collecting from waiting farmers and dispatching to waiting buyers.
- **Audit & Governance**: Two-party verification mechanism—vendors submit edit or deletion requests for recorded transactions, requiring target user consent.

#### D. Administrator Portal
- **Privileged Access**: Locked exclusively to authorized Google administrative accounts via OAuth.
- **Support Ticket Pipeline**: Inspects incoming `passwordResetRequests`, enabling administrators to verify user identity before dispatching reset instructions.

---

### 3. CSS & UI/UX Engineering Analysis

#### The "Before vs After" Rework
During our codebase analysis, an architectural issue was identified:
- **Massive Inline CSS Bloat**: Over 2,200 lines of CSS were hardcoded inside inline `<style>` tags in `buyer.html`, `seller.html`, and `vendor.html`.
- **Runtime CSS Injection**: `vendor.js` was dynamically injecting 200+ lines of CSS into `<head>` at runtime, leading to Cumulative Layout Shift (CLS) and specificity wars.
- **Broken Browser Caching**: Because styles were embedded in HTML files, stylesheets could not be cached independently by the browser CDN.
- **Accessibility Anti-Patterns**: `maximum-scale=1.0` was present in `<meta name="viewport">`, preventing visually impaired users from zooming.

#### Rework Implemented
- **Modular Stylesheet Architecture**:
  - [`public/css/vendor.css`](file:///c:/Users/AbdulRahuman/OneDrive/Desktop/MILKIBA/public/css/vendor.css): Unified all vendor rules, responsive grids, modals, and dynamic history tables.
  - [`public/css/buyer.css`](file:///c:/Users/AbdulRahuman/OneDrive/Desktop/MILKIBA/public/css/buyer.css): Consolidated all buyer dashboard rules with modern CSS variables.
  - [`public/css/seller.css`](file:///c:/Users/AbdulRahuman/OneDrive/Desktop/MILKIBA/public/css/seller.css): Dedicated farmer portal stylesheet with agrarian green branding.
  - [`public/css/auth.css`](file:///c:/Users/AbdulRahuman/OneDrive/Desktop/MILKIBA/public/css/auth.css): Harmonized registration styling to match `login.css` with focus rings and home navigation.
- **Clean HTML Documents**: Removed over 2,200 lines of duplicate `<style>` blocks across all pages.
- **Zero Runtime Injection**: Removed dynamic `historyStyle` DOM injection from `vendor.js`.
- **Mobile First & Touch Optimized**:
  - Removed `maximum-scale=1.0` for full WCAG compliance.
  - Ensured all buttons and touch inputs respect a minimum touch target size of 44px.
  - Integrated smooth horizontal table scrolling (`overflow-x: auto; -webkit-overflow-scrolling: touch`) so financial tables never clip on mobile displays.
  - Standardized clickable logo branding across all pages.

---

### 4. Security, Rules & Data Integrity Audit

#### Critical Validation Fix
- **Root Cause**: In [`database.rules.json`](file:///c:/Users/AbdulRahuman/OneDrive/Desktop/MILKIBA/database.rules.json), `sellerNotifications/milkAvailable` and `buyerNotifications/milkRequired` were strictly validated with `.validate: "newData.isNumber()"`.
- **Impact**: Both `seller.js` and `buyer.js` send boolean values (`true` / `false`). Firebase Realtime Database rejected every status update as an unauthorized write!
- **Resolution**: Updated validation expressions to `.validate: "newData.isBoolean() || newData.isNumber()"`.

#### Access Control Matrix

| Node | Read Permission | Write Permission |
|---|---|---|
| `/users/{uid}` | Self or Vendor | Self only |
| `/sellerNotifications/{id}` | Vendor or Seller | Vendor, or Seller owning the record |
| `/buyerNotifications/{id}` | Vendor or Buyer | Vendor, or Buyer owning the record |
| `/milkCollections/{id}` | Vendor or Seller | Vendor, or Seller owning the transaction |
| `/milkSupplies/{id}` | Vendor, Buyer, Seller | Vendor, or Buyer owning the transaction |
| `/changeRequests/{id}` | Vendor, Buyer, Seller | Vendor (propose) or Target User (approve/reject) |
| `/passwordResetRequests/{id}` | Authorized Admin Email | Public creation (Pending status) / Admin review |

---

### 5. Performance & Optimization Audit

- **Asset Footprint**: Zero heavy frontend framework dependencies (React/Angular/Vue); uses clean Vanilla JavaScript ES6 modules.
- **CDN Caching**: Static HTML, CSS, and JS assets leverage Firebase Hosting's global Fastly CDN edge nodes.
- **Clean URLs**: Configured `"cleanUrls": true` in `firebase.json` so URLs like `/buyer`, `/seller`, and `/vendor` resolve automatically without `.html` extensions.

---

## 📊 Database Schema & Security Matrix

```json
{
  "users": {
    "<uid>": {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "buyer | seller | vendor",
      "createdAt": "ISO-8601 Timestamp"
    }
  },
  "sellerNotifications": {
    "<sellerId_date_session>": {
      "sellerId": "UID",
      "sellerName": "Farmer John",
      "date": "YYYY-MM-DD",
      "session": "morning | evening",
      "milkAvailable": true,
      "estimatedQuantity": 25.5,
      "updatedAt": "ISO-8601 Timestamp"
    }
  },
  "buyerNotifications": {
    "<buyerId_date_session>": {
      "buyerId": "UID",
      "buyerName": "Alice Smith",
      "date": "YYYY-MM-DD",
      "session": "morning | evening",
      "milkRequired": true,
      "requestedQuantity": 2.0,
      "updatedAt": "ISO-8601 Timestamp"
    }
  },
  "milkCollections": {
    "<transactionId>": {
      "sellerId": "UID",
      "vendorId": "UID",
      "actualQuantity": 24.0,
      "rate": 45.0,
      "totalAmount": 1080.0,
      "paymentStatus": "Paid | Partial | Not Paid",
      "transactionStatus": "Collected"
    }
  },
  "milkSupplies": {
    "<transactionId>": {
      "buyerId": "UID",
      "vendorId": "UID",
      "suppliedQuantity": 2.0,
      "rate": 55.0,
      "totalAmount": 110.0,
      "paymentStatus": "Paid | Partial | Not Paid",
      "transactionStatus": "Supplied"
    }
  }
}
```

---

## 📂 Project Structure

```text
MILKIBA/
├── .firebaserc                # Active Firebase project alias (milkiba-18)
├── .gitignore                 # Ignore rules for .venv, node_modules, cache, OS files
├── database.rules.json        # Realtime Database RBAC validation rules
├── firebase.json              # Hosting configuration (cleanUrls enabled)
├── README.md                  # Comprehensive documentation and analysis
└── public/                    # Web application assets
    ├── index.html             # Landing page with hero video & responsive nav
    ├── login.html             # User login portal
    ├── register.html          # New user registration with role selector
    ├── buyer.html             # Buyer dashboard (requirement toggle, history)
    ├── seller.html            # Seller dashboard (availability toggle, payouts)
    ├── vendor.html            # Vendor dashboard (collections, supplies, approvals)
    ├── admin.html             # Admin console (Google OAuth)
    ├── about.html             # About MILKIBA story & mission
    ├── contact.html           # Customer support & communication channels
    ├── passwordReset.html     # Password reset request form
    ├── assets/                # Background video and brand assets
    │   └── milk-video.mp4     # Optimized hero background media
    ├── css/                   # Modular Stylesheets
    │   ├── style.css          # Homepage & landing layout
    │   ├── auth.css           # Registration screen styles
    │   ├── login.css          # Login screen styles
    │   ├── buyer.css          # Clean buyer portal styles
    │   ├── seller.css         # Agrarian seller portal styles
    │   └── vendor.css         # Complete vendor dashboard & table styles
    └── js/                    # ES6 Modules
        ├── firebase-config.js # Firebase SDK initialization & exports
        ├── auth.js            # User registration & role creation
        ├── login.js           # Authentication & role-based routing
        ├── buyer.js           # Buyer state management & history renderer
        ├── seller.js          # Seller state management & collection viewer
        ├── vendor.js          # Vendor collection, supply, ledger & calculations
        ├── admin.js           # Admin authentication & request reviewer
        └── passwordReset.js   # Password reset request dispatcher
```

---

## 🚀 Getting Started & Local Testing

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Firebase CLI](https://firebase.google.com/docs/cli) installed globally:
  ```bash
  npm install -g firebase-tools
  ```

### 2. Running Locally
Run the site locally with Firebase Emulator:
```bash
# Login to Firebase
firebase login

# Start local hosting emulator
firebase emulators:start --only hosting
```
Or view directly with any local static HTTP server:
```bash
# Python built-in server
python -m http.server 8000 --directory public
```
Visit `http://localhost:8000` in your browser.

---

## 🚀 Firebase Deployment Guide

Deploy changes to live Firebase production:
```bash
# Deploy both Database rules and Hosting assets
firebase deploy

# Or deploy only database security rules
firebase deploy --only database

# Or deploy only hosting
firebase deploy --only hosting
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
