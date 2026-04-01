# Step-by-Step Testing Guide

## Prerequisites
- ✅ MongoDB running and accessible
- ✅ Node.js and npm installed
- ✅ `.env` file configured with:
  ```
  PORT=5000
  MONGO_URI=mongodb://localhost:27017/foodsaver
  JWT_SECRET=your_secret_key_here
  ```

---

## Step 1: Install Dependencies

```bash
cd c:\Users\sanja\OneDrive\Desktop\foodapp
npm install
```

---

## Step 2: Start MongoDB

**On Windows (if installed):**
```bash
# Open new terminal
mongod
```

**Or use MongoDB Compass/Atlas connection string in .env**

---

## Step 3: Start the Backend Server

```bash
# Make sure you're in the foodapp directory
node server.js
```

**Expected output:**
```
✓ MongoDB connected successfully
✓ Server running on port 5000
Environment: development
```

---

## Step 4: Test the API

### Option A: Using Postman/Thunder Client (Easiest)

**Test 1: Check if server is running**
```
GET http://localhost:5000/api/health
```

Expected Response:
```json
{
    "success": true,
    "message": "Server is running",
    "timestamp": "2024-03-04T10:30:45.123Z"
}
```

---

### Test 2: Register a New User

```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
    "name": "pragadeesh",
    "email": "pragadeesh@gmail.com",
    "password": "password123",
    "role": "Provider",
    "contactNumber": "9597403601",
    "district": "Coimbatore"
}
```

Expected Response (201 Created):
```json
{
    "success": true,
    "message": "User registered successfully",
    "data": {
        "_id": "65e5c123abc456def789abc0",
        "name": "pragadeesh",
        "email": "pragadeesh@gmail.com",
        "role": "Provider",
        "contactNumber": "9597403601",
        "district": "Coimbatore",
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY1ZTVjMTIzYWJjNDU2ZGVmNzg5YWJjMCIsImlhdCI6MTcwOTU1NzA0NSwiZXhwIjoxNzEyMTQ5MDQ1fQ...."
    }
}
```

✅ **COPY THE TOKEN** from the response!

---

### Test 3: Check MongoDB Storage

**Open MongoDB Compass or shell:**
```javascript
// JavaScript (MongoDB shell)
use foodsaver
db.users.findOne({ email: "pragadeesh@gmail.com" })
```

**You should see:**
```json
{
  "_id": ObjectId("65e5c123abc456def789abc0"),
  "name": "pragadeesh",
  "email": "pragadeesh@gmail.com",
  "password": "$2a$10$FKJh....", // HASHED PASSWORD ✅
  "role": "Provider",
  "contactNumber": "9597403601",
  "district": "Coimbatore",
  "createdAt": ISODate("2024-03-04T10:30:45.123Z"),
  "updatedAt": ISODate("2024-03-04T10:30:45.123Z")
}
```

✅ **Password is hashed** - This is correct!

---

### Test 4: Login with Registered User

```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
    "email": "pragadeesh@gmail.com",
    "password": "password123"
}
```

Expected Response (200 OK):
```json
{
    "success": true,
    "message": "Login successful",
    "data": {
        "_id": "65e5c123abc456def789abc0",
        "name": "pragadeesh",
        "email": "pragadeesh@gmail.com",
        "role": "Provider",
        "contactNumber": "9597403601",
        "district": "Coimbatore",
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
    }
}
```

✅ **Login works!**

---

### Test 5: Verify Token

```
GET http://localhost:5000/api/auth/verify
Headers:
    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
```

Expected Response (200 OK):
```json
{
    "success": true,
    "message": "Token is valid",
    "data": {
        "_id": "65e5c123abc456def789abc0",
        "name": "pragadeesh",
        "email": "pragadeesh@gmail.com",
        "role": "Provider",
        "contactNumber": "9597403601",
        "district": "Coimbatore"
    }
}
```

✅ **Token is valid!**

---

### Test 6: Error Handling - Wrong Password

```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
    "email": "pragadeesh@gmail.com",
    "password": "wrongpassword"
}
```

Expected Response (401 Unauthorized):
```json
{
    "success": false,
    "message": "Invalid email or password"
}
```

✅ **Error handling works!**

---

### Test 7: Error Handling - Duplicate Email

```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
    "name": "different name",
    "email": "pragadeesh@gmail.com",  // Same email as before
    "password": "password123",
    "role": "Recipient",
    "contactNumber": "9876543210",
    "district": "Chennai"
}
```

Expected Response (409 Conflict):
```json
{
    "success": false,
    "message": "User with this email already exists"
}
```

✅ **Duplicate prevention works!**

---

### Test 8: Validation - Missing Fields

```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
    "name": "john",
    "email": "john@example.com"
    // Missing password, role, contactNumber, district
}
```

Expected Response (400 Bad Request):
```json
{
    "success": false,
    "message": "Please provide all required fields"
}
```

✅ **Validation works!**

---

### Test 9: Validation - Invalid Email

```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
    "name": "john",
    "email": "invalid-email",  // Invalid format
    "password": "password123",
    "role": "Provider",
    "contactNumber": "9876543210",
    "district": "Mumbai"
}
```

Expected Response (400 Bad Request):
```json
{
    "success": false,
    "message": "Invalid email format"
}
```

✅ **Email validation works!**

---

### Test 10: Validation - Invalid Phone Number

```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
    "name": "john",
    "email": "john@example.com",
    "password": "password123",
    "role": "Provider",
    "contactNumber": "123",  // Invalid - should be 10 digits
    "district": "Mumbai"
}
```

Expected Response (400 Bad Request):
```json
{
    "success": false,
    "message": "Please add a valid 10-digit contact number"
}
```

✅ **Phone validation works!**

---

## Option B: Using cURL (Command Line)

### Register User:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pragadeesh",
    "email": "pragadeesh@gmail.com",
    "password": "password123",
    "role": "Provider",
    "contactNumber": "9597403601",
    "district": "Coimbatore"
  }'
```

### Login:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pragadeesh@gmail.com",
    "password": "password123"
  }'
```

### Verify Token:
```bash
curl -X GET http://localhost:5000/api/auth/verify \
  -H "Authorization: Bearer <paste_token_here>"
```

---

## Testing Checklist

- [ ] Server starts without errors (`node server.js`)
- [ ] Health endpoint works (`GET /api/health`)
- [ ] Can register a new user with valid data
- [ ] User appears in MongoDB with hashed password
- [ ] Can login with correct email/password
- [ ] Cannot login with wrong password
- [ ] Cannot register duplicate email
- [ ] Cannot register with invalid email format
- [ ] Cannot register with invalid phone number (not 10 digits)
- [ ] Cannot register with missing fields
- [ ] Token verification works with valid token
- [ ] Token verification fails without token header
- [ ] Error responses have proper status codes
- [ ] No "next is not a function" errors anywhere

---

## Common Errors & Solutions

### Error: "next is not a function"
✅ **FIXED** - All middleware now properly uses next as a function parameter

### Error: "Cannot read property 'password' of undefined"
✅ **FIXED** - User model now has proper validation and pre-save hooks

### Error: "User with this email already exists" when trying to register
✅ **EXPECTED** - Try registering with a different email address

### Error: "Invalid email or password" when logging in
✅ **EXPECTED** - Check that:
  - Email was registered correctly
  - Password is typed exactly as registered
  - Remember passwords are case-sensitive

### Error: "MongoDB connection error"
❌ **CHECK**:
  - Is MongoDB server running?
  - Is MONGO_URI in .env correct?
  - Try connection with MongoDB Compass first

---

## Next Steps

Once testing is complete:

1. ✅ Test registration with different roles (Provider, Recipient, Admin)
2. ✅ Test protected routes like `/api/foodposts`, `/api/requests` using valid tokens
3. ✅ Test authorization (can a Recipient create a food post? - should fail)
4. ✅ Update your frontend to use the new response format

---

## Frontend Integration

Update your React login/register code to use the new response format:

```javascript
// Registration
const response = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
});

const data = await response.json();

if (data.success) {
    // Registration successful
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data));
    navigate('/dashboard');
} else {
    // Show error
    alert(data.message);
}
```

---

**All tests should pass without any errors!** ✨
