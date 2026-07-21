import jwt from 'jsonwebtoken';
import { pool } from '../../config/db.js';

const MAX_HANDOFF_TTL_SECONDS = 5 * 60;
const PORTAL_SESSION_TTL = '2h';

export class HqSsoConfigurationError extends Error {}
export class HqSsoAuthenticationError extends Error {}

function getHandoffSecret() {
  const secret = process.env.AGAP_PORTAL_SSO_SECRET?.trim();
  if (!secret) {
    throw new HqSsoConfigurationError('AGAP_PORTAL_SSO_SECRET is required');
  }
  return secret;
}

function getPortalJwtSecret() {
  return process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';
}

function isUnixTimestamp(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

function verifyHandoffToken(token, now = Math.floor(Date.now() / 1000)) {
  let claims;
  try {
    claims = jwt.verify(token, getHandoffSecret(), {
      algorithms: ['HS256'],
      issuer: 'insighted-hq',
      audience: 'agap-portal',
      clockTimestamp: now,
    });
  } catch (error) {
    if (error instanceof HqSsoConfigurationError) throw error;
    throw new HqSsoAuthenticationError('Invalid or expired HQ sign-in token');
  }

  if (
    typeof claims !== 'object' ||
    claims.type !== 'hq_sso' ||
    typeof claims.username !== 'string' ||
    !claims.username.trim() ||
    claims.sub !== claims.username ||
    typeof claims.jti !== 'string' ||
    !claims.jti ||
    !isUnixTimestamp(claims.iat) ||
    !isUnixTimestamp(claims.exp) ||
    claims.iat > now + 30 ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > MAX_HANDOFF_TTL_SECONDS
  ) {
    throw new HqSsoAuthenticationError('Invalid HQ sign-in token payload');
  }

  return claims.username.trim();
}

export async function exchangeHqSsoToken(token) {
  const username = verifyHandoffToken(token);
  const { rows } = await pool.query(
    `SELECT id, username, role, full_name, status, locked_until
     FROM users
     WHERE username = $1
     LIMIT 1`,
    [username],
  );
  const user = rows[0];

  if (!user || user.status !== 'active') {
    throw new HqSsoAuthenticationError('Configured AGAP Portal account is unavailable');
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new HqSsoAuthenticationError('Configured AGAP Portal account is locked');
  }

  await pool.query('UPDATE users SET last_login_at = $1 WHERE id = $2', [new Date(), user.id]);

  const accessToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
    getPortalJwtSecret(),
    { expiresIn: PORTAL_SESSION_TTL },
  );

  return {
    token: accessToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
    },
  };
}
