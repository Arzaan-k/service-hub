# How to Get Your Auth Token for Manual Upload

## Option 1: Use Existing Admin User (Recommended)

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Run the token script:**
   ```bash
   node get-admin-token.js
   ```

3. **Copy the token** from the output and use it in your bulk upload script.

## Option 2: Create New Admin User

If the default admin user doesn't exist or doesn't have a password:

1. **Create admin user:**
   ```bash
   node create-admin-user.js
   ```

2. **Use the token** shown in the output.

## Option 3: Manual Login via API

You can also login manually using curl:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@containergenie.com","password":"admin123"}'
```

The response will contain your token.

## Default Admin Credentials

- **Email:** `admin@containergenie.com`
- **Password:** `admin123`
- **Phone:** `+1234567890`
- **Role:** `admin`

## Using the Token

Once you have the token, update `bulk-upload-manuals.js`:

```javascript
const AUTH_TOKEN = 'your-actual-token-here'; // Replace with the token you got
```

Or set it as an environment variable:

```bash
AUTH_TOKEN="your-token" node bulk-upload-manuals.js
```

## Troubleshooting

- **"User not found"**: Run `node create-admin-user.js` to create an admin user
- **"Invalid credentials"**: Make sure you're using the correct email/password
- **Server not running**: Start with `npm run dev` first

