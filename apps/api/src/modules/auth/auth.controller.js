import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../../config/db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';

export async function login(req, res) {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'locked' && user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Account is locked. Please try again later.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      let status = user.status;
      let lockedUntil = user.locked_until;
      if (attempts >= 5) {
        status = 'locked';
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      }
      await pool.query(
        'UPDATE users SET failed_login_attempts = $1, status = $2, locked_until = $3 WHERE id = $4',
        [attempts, status, lockedUntil, user.id]
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed attempts
    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = null, last_login_at = $1 WHERE id = $2',
      [new Date(), user.id]
    );

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during login' });
  }
}

export async function register(req, res) {
  const { username, email, full_name, password, role, contact_number, office } = req.body;
  if (!username || !email || !full_name || !password) {
    return res.status(400).json({ error: 'Username, email, full name, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    // Check if username or email already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already in use.' });
    }
    const id = randomUUID();
    const password_hash = await bcrypt.hash(password, 10);
    const userRole = role || 'hr_officer';
    await pool.query(
      `INSERT INTO users (id, username, email, full_name, contact_number, office, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')`,
      [id, username, email, full_name, contact_number || null, office || null, password_hash, userRole]
    );
    res.status(201).json({ message: 'Account created successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
}

export async function verifyPasscode(req, res) {
  const { passcode } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!user || !user.passcode_hash) {
      return res.status(400).json({ error: 'No passcode configured for user' });
    }
    let isValid = await bcrypt.compare(passcode, user.passcode_hash);
    if (!isValid && user.password_hash) {
      isValid = await bcrypt.compare(passcode, user.password_hash);
    }
    if (isValid) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid passcode' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
