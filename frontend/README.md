# CivicTwin Frontend

React frontend for the CivicTwin AI Powered Governance Platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

The app will run on http://localhost:5173

## Features

### Authentication Pages ✅
- Login with phone/password
- Signup with Aadhaar verification
- OTP verification via WhatsApp
- Forgot password flow

### Citizen Portal (Coming Soon)
- Dashboard
- File complaints
- Track complaints
- Social feed
- Trending topics
- Public tenders

### Admin Dashboard (Coming Soon)
- User management
- Complaint management
- Fraud detection
- Sentiment analysis
- System analytics

## API Endpoints

The frontend connects to the backend API running on `http://localhost:3000`

Make sure your backend server is running before starting the frontend.

## Tech Stack

- React 18
- Vite
- React Router v6
- Axios
- React Hot Toast
