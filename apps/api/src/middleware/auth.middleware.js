import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
  
  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

export function requireHrmoAccess(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase().trim();
  const position = String(req.user?.position || '').toLowerCase().trim();
  if (role === 'regional_office' || role === 'regional' || position === 'regional office') {
    return res.status(403).json({
      error: 'Access restricted: Regional Office accounts can only access the Reclassification module.'
    });
  }
  next();
}

export function requireHrOfficerAccess(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase().trim();
  const position = String(req.user?.position || '').toLowerCase().trim();
  const isRo = role === 'regional_office' || 
               role === 'regional_director' || 
               (role.includes('regional') && role !== 'admin') || 
               position === 'regional office';
  if (isRo && role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({
      error: 'Access restricted: Uploading NOSCA and assigning item numbers is restricted to the HR Officer and unavailable to Regional Office accounts.'
    });
  }
  next();
}

export function requireRegionalOfficeAccess(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase().trim();
  const position = String(req.user?.position || '').toLowerCase().trim();
  const isRo = role === 'regional_office' || 
               role === 'regional_director' || 
               role.includes('regional') || 
               position === 'regional office' || 
               role === 'admin' || 
               role === 'superadmin';
  if (!isRo) {
    return res.status(403).json({
      error: 'Access restricted: SDO personnel are not authorized to perform this regional action.'
    });
  }
  next();
}

