# Re-enable OTP Verification

This document describes the changes needed to restore full OTP verification functionality.

---

## Changes Required in `frontend/src/pages/auth/Login.jsx`

### **Change 1: Initialize otpVerified as false**

**Location:** Line ~18 (in useState declarations)

**FROM:**
```javascript
const [otpVerified, setOtpVerified] = useState(true) // Set to true for testing (mock verified)
```

**TO:**
```javascript
const [otpVerified, setOtpVerified] = useState(false)
```

---

### **Change 2: Uncomment OTP validation check**

**Location:** Lines ~91-94 (in handleSubmit function)

**FROM:**
```javascript
// Mock mode - skip OTP verification check for testing
// if (!otpVerified) {
//   toast.error('Please verify your Aadhaar with OTP first')
//   return
// }
```

**TO:**
```javascript
if (!otpVerified) {
  toast.error('Please verify your Aadhaar with OTP first')
  return
}
```

---

### **Change 3: Add disabled attribute to Aadhaar input**

**Location:** Around line ~155 (in Aadhaar input field)

**FROM:**
```javascript
<input
  type="text"
  id="aadhaar"
  name="aadhaar"
  className="form-input"
  placeholder="12-digit Aadhaar number"
  value={formData.aadhaar}
  onChange={handleChange}
  required
  pattern="[0-9]{12}"
  maxLength="12"
  style={{ flex: 1 }}
/>
```

**TO:**
```javascript
<input
  type="text"
  id="aadhaar"
  name="aadhaar"
  className="form-input"
  placeholder="12-digit Aadhaar number"
  value={formData.aadhaar}
  onChange={handleChange}
  required
  pattern="[0-9]{12}"
  maxLength="12"
  disabled={otpVerified}
  style={{ flex: 1 }}
/>
```

---

## Changes Required in `frontend/src/pages/auth/Signup.jsx`

### **Change 1: Initialize otpVerified as false**

**Location:** Line ~20 (in useState declarations)

**FROM:**
```javascript
const [otpVerified, setOtpVerified] = useState(true) // Set to true for testing (mock verified)
```

**TO:**
```javascript
const [otpVerified, setOtpVerified] = useState(false)
```

---

### **Change 2: Uncomment OTP validation check**

**Location:** Lines ~93-97 (in handleSubmit function)

**FROM:**
```javascript
// Validation
// Mock mode - skip OTP verification check for testing
// if (!otpVerified) {
//   toast.error('Please verify your Aadhaar with OTP first')
//   return
// }
```

**TO:**
```javascript
// Validation
if (!otpVerified) {
  toast.error('Please verify your Aadhaar with OTP first')
  return
}
```

---

### **Change 3: Add disabled attribute to Aadhaar input**

**Location:** Around line ~205 (in Aadhaar input field)

**FROM:**
```javascript
<input
  type="text"
  id="aadhaar"
  name="aadhaar"
  className="form-input"
  placeholder="12-digit Aadhaar number"
  value={formData.aadhaar}
  onChange={handleChange}
  required
  pattern="[0-9]{12}"
  maxLength="12"
  style={{ flex: 1 }}
/>
```

**TO:**
```javascript
<input
  type="text"
  id="aadhaar"
  name="aadhaar"
  className="form-input"
  placeholder="12-digit Aadhaar number"
  value={formData.aadhaar}
  onChange={handleChange}
  required
  pattern="[0-9]{12}"
  maxLength="12"
  disabled={otpVerified}
  style={{ flex: 1 }}
/>
```

---

## Result

After applying these changes to both files:
- ✅ Users will need to verify Aadhaar with OTP before logging in or signing up
- ✅ "Send OTP" button will appear when 12-digit Aadhaar is entered
- ✅ OTP input field will appear after sending OTP
- ✅ Aadhaar field will be disabled after verification
- ✅ Forms cannot be submitted without OTP verification

---

## Current State (Mock Mode)

Both Login.jsx and Signup.jsx are currently in **mock mode** for testing:
- `otpVerified` starts as `true` - Shows "✓ Verified" immediately
- OTP validation is commented out - Forms can be submitted without verifying OTP
- Aadhaar input has no `disabled` attribute - Users can enter Aadhaar freely
