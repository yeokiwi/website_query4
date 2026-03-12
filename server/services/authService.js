import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CREDENTIALS_FILE = path.resolve(
  process.env.CREDENTIALS_FILE || path.join(PROJECT_ROOT, 'credentials.json')
);

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = '12345';

// In-memory token store: token -> { username, createdAt }
const activeTokens = new Map();
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function readCredentials() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    // Initialize with defaults
    const salt = crypto.randomBytes(16).toString('hex');
    const hashed = hashPassword(DEFAULT_PASSWORD, salt);
    const creds = { username: DEFAULT_USERNAME, password: hashed, salt };
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
    return creds;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
}

function saveCredentials(creds) {
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
}

export function login(username, password) {
  const creds = readCredentials();
  if (username !== creds.username) return null;

  const hashed = hashPassword(password, creds.salt);
  if (hashed !== creds.password) return null;

  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.set(token, { username, createdAt: Date.now() });
  return token;
}

export function validateToken(token) {
  if (!token) return false;
  const session = activeTokens.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > TOKEN_EXPIRY_MS) {
    activeTokens.delete(token);
    return false;
  }
  return true;
}

export function logout(token) {
  activeTokens.delete(token);
}

export function changeCredentials(token, { newUsername, newPassword, currentPassword }) {
  if (!validateToken(token)) return { error: 'Unauthorized' };

  const creds = readCredentials();

  // Verify current password
  const currentHashed = hashPassword(currentPassword, creds.salt);
  if (currentHashed !== creds.password) {
    return { error: 'Current password is incorrect' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const username = newUsername || creds.username;
  const password = newPassword || currentPassword;
  const hashed = hashPassword(password, salt);

  saveCredentials({ username, password: hashed, salt });

  // Invalidate all tokens so user must re-login with new credentials
  activeTokens.clear();

  return { success: true };
}

// Express middleware
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!validateToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
