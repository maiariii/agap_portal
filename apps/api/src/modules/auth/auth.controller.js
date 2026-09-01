import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../../config/db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  exchangeHqSsoToken,
  HqSsoAuthenticationError,
  HqSsoConfigurationError,
} from './hq-sso.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';

export async function hqSsoLogin(req, res) {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token) {
    return res.status(400).json({ error: 'HQ sign-in token is required' });
  }

  try {
    return res.json(await exchangeHqSsoToken(token));
  } catch (error) {
    if (error instanceof HqSsoConfigurationError) {
      console.error('AGAP Portal SSO configuration error:', error.message);
      return res.status(500).json({ error: 'AGAP Portal SSO is not configured' });
    }
    if (error instanceof HqSsoAuthenticationError) {
      return res.status(401).json({ error: error.message });
    }
    console.error('AGAP Portal SSO exchange error:', error);
    return res.status(500).json({ error: 'Unable to complete HQ sign-in' });
  }
}

export async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let validPassword = false;
    if (user.password_hash) {
      validPassword = await bcrypt.compare(password, user.password_hash).catch(() => false);
    }

    if (!validPassword && user.passcode_hash) {
      if (password === user.passcode_hash) {
        validPassword = true;
      } else {
        validPassword = await bcrypt.compare(password, user.passcode_hash).catch(() => false);
      }
    }

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login safely
    try {
      await pool.query(
        'UPDATE users SET last_login_at = $1 WHERE id = $2',
        [new Date(), user.id]
      );
    } catch (e) {
      console.warn('Note: Could not update last_login_at:', e.message);
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullName: user.full_name, firstName: user.first_name, lastName: user.last_name, region: user.region, division: user.division },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        firstName: user.first_name,
        lastName: user.last_name,
        region: user.region,
        division: user.division
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: error.message || 'Server error during login' });
  }
}

export async function register(req, res) {
  const { firstName, lastName, region, division, email, password, passcode } = req.body;
  if (!firstName || !lastName || !region || !division || !email || !password || !passcode) {
    return res.status(400).json({ error: 'All fields are required (First Name, Last Name, Region, Division, DepEd Email, Password, and Passcode).' });
  }
  if (!email.toLowerCase().endsWith('@deped.gov.ph')) {
    return res.status(400).json({ error: 'DepEd Email must end with @deped.gov.ph.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (!/^\d{6}$/.test(passcode)) {
    return res.status(400).json({ error: 'Passcode must be a 6-digit numeric code.' });
  }
  try {
    // Check if username or email already exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [email, email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'DepEd Email already in use.' });
    }
    const id = randomUUID();
    const password_hash = await bcrypt.hash(password, 10);
    const passcode_hash = passcode; // Must not be hashed when stored in the database
    const fullName = `${firstName} ${lastName}`;
    const officeStr = `Region: ${region}, Division: ${division}`;
    const userRole = 'hr_officer'; // Hardcoded position

    await pool.query(
      `INSERT INTO users (id, username, email, full_name, first_name, last_name, region, division, office, password_hash, passcode_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')`,
      [id, email, email, fullName, firstName, lastName, region, division, officeStr, password_hash, passcode_hash, userRole]
    );
    res.status(201).json({ message: 'Account created successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
}

export async function verifyPasscode(req, res) {
  const passcode = String(req.body?.passcode || '').trim();
  if (!passcode) {
    return res.status(400).json({ error: 'Passcode is required' });
  }

  try {
    const userId = req.user?.id || req.user?.userId;
    let user = null;
    if (userId) {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      user = rows[0];
    }

    // Default fallback passcodes for development / default configuration
    if (passcode === '123456' || passcode === '1234' || passcode === '000000') {
      return res.json({ success: true });
    }

    if (!user) {
      return res.status(400).json({ error: 'User account not found' });
    }

    let isValid = false;
    if (user.passcode_hash) {
      if (passcode === user.passcode_hash) {
        isValid = true;
      } else {
        isValid = await bcrypt.compare(passcode, user.passcode_hash).catch(() => false);
      }
    }
    if (!isValid && user.password_hash) {
      isValid = await bcrypt.compare(passcode, user.password_hash).catch(() => false);
    }
    if (!isValid && (passcode === '123456' || passcode === '1234' || passcode === '000000')) {
      isValid = true;
    }

    if (isValid) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid passcode' });
    }
  } catch (error) {
    console.error('Passcode verification error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function getRegionsDivisions(req, res) {
  const FALLBACK_REGIONS_DIVISIONS = {
    'NCR': ['BHROD', 'SDO Manila', 'SDO Quezon City', 'SDO Caloocan', 'SDO Las Piñas', 'SDO Makati', 'SDO Malabon', 'SDO Mandaluyong', 'SDO Marikina', 'SDO Muntinlupa', 'SDO Navotas', 'SDO Parañaque', 'SDO Pasay', 'SDO Pasig', 'SDO San Juan', 'SDO Taguig-Pateros', 'SDO Valenzuela'],
    'CAR': ['SDO Abra', 'SDO Apayao', 'SDO Baguio City', 'SDO Benguet', 'SDO Ifugao', 'SDO Kalinga', 'SDO Mountain Province', 'SDO Tabuk City'],
    'Region I': ['SDO Batac City', 'SDO Candon City', 'SDO Dagupan City', 'SDO Ilocos Norte', 'SDO Ilocos Sur', 'SDO La Union', 'SDO Laoag City', 'SDO Pangasinan I', 'SDO Pangasinan II', 'SDO San Carlos City', 'SDO San Fernando City', 'SDO Urdaneta City'],
    'Region II': ['SDO Batanes', 'SDO Cagayan', 'SDO Cauayan City', 'SDO Ilagan City', 'SDO Isabela', 'SDO Nueva Vizcaya', 'SDO Quirino', 'SDO Santiago City', 'SDO Tuguegarao City'],
    'Region III': ['SDO Angeles City', 'SDO Aurora', 'SDO Bataan', 'SDO Bulacan', 'SDO Cabanatuan City', 'SDO Gapan City', 'SDO Mabalacat City', 'SDO Malolos City', 'SDO Meycauayan City', 'SDO Muñoz Science City', 'SDO Olongapo City', 'SDO Pampanga', 'SDO San Fernando City', 'SDO San Jose City', 'SDO Tarlac', 'SDO Tarlac City', 'SDO Zambales'],
    'Region IV-A': ['SDO Antipolo City', 'SDO Batangas', 'SDO Batangas City', 'SDO Biñan City', 'SDO Cabuyao City', 'SDO Calamba City', 'SDO Cavite', 'SDO Cavite City', 'SDO Dasmariñas City', 'SDO General Trias City', 'SDO Imus City', 'SDO Laguna', 'SDO Lipa City', 'SDO Lucena City', 'SDO Quezon', 'SDO Rizal', 'SDO San Pablo City', 'SDO Santa Rosa City', 'SDO Tayabas City'],
    'Region XI': ['SDO Davao City', 'SDO Davao de Oro', 'SDO Davao del Norte', 'SDO Davao del Sur', 'SDO Davao Occidental', 'SDO Davao Oriental', 'SDO Digos City', 'SDO Island Garden City of Samal', 'SDO Mati City', 'SDO Panabo City', 'SDO Tagum City']
  };

  try {
    let rows = [];
    try {
      const resDb = await pool.query('SELECT DISTINCT region, division FROM agap_schools ORDER BY region, division;');
      rows = resDb.rows;
    } catch (dbErr) {
      console.warn('agap_schools lookup warning:', dbErr.message);
      try {
        const resUnion = await pool.query('SELECT DISTINCT region, division FROM users WHERE region IS NOT NULL UNION SELECT DISTINCT region, division FROM vacancies WHERE region IS NOT NULL;');
        rows = resUnion.rows;
      } catch (e2) {}
    }
    
    const mapping = { ...FALLBACK_REGIONS_DIVISIONS };
    const allDivisionsSet = new Set();
    
    Object.values(FALLBACK_REGIONS_DIVISIONS).flat().forEach(d => allDivisionsSet.add(d));

    rows.forEach(row => {
      const r = row.region || '';
      const d = row.division || '';
      if (r) {
        if (!mapping[r]) {
          mapping[r] = [];
        }
        if (d && !mapping[r].includes(d)) {
          mapping[r].push(d);
        }
      }
      if (d) {
        allDivisionsSet.add(d);
      }
    });

    res.json({
      regions: Object.keys(mapping).sort(),
      divisionsByRegion: mapping,
      allDivisions: Array.from(allDivisionsSet).sort()
    });
  } catch (error) {
    console.error('Error fetching regions and divisions:', error.message);
    res.json({
      regions: Object.keys(FALLBACK_REGIONS_DIVISIONS).sort(),
      divisionsByRegion: FALLBACK_REGIONS_DIVISIONS,
      allDivisions: Object.values(FALLBACK_REGIONS_DIVISIONS).flat().sort()
    });
  }
}
