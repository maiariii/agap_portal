import { pool } from '../../config/db.js';
import { CollaboratorInviteSchema } from '@agap/shared';

/**
 * GET /api/collaborators
 * Returns active collaborators invited by the authenticated HRMO host
 */
export async function getCollaborators(req, res) {
  try {
    const hostHrmoId = req.user?.id || req.user?.userId;
    if (!hostHrmoId) {
      return res.status(401).json({ error: 'Unauthorized: Missing host user identification' });
    }

    const { rows } = await pool.query(`
      SELECT 
        id, 
        first_name, 
        last_name, 
        position, 
        email, 
        region_id, 
        division_id, 
        host_hrmo_id, 
        created_at
      FROM collaborators
      WHERE host_hrmo_id = $1
      ORDER BY created_at DESC;
    `, [hostHrmoId]);

    return res.json({
      success: true,
      collaborators: rows
    });
  } catch (err) {
    console.error('[Collaborators Controller] getCollaborators error:', err);
    return res.status(500).json({ error: 'Failed to retrieve collaborators' });
  }
}

/**
 * POST /api/collaborators/invite
 * Invites an assistant/helper to collaborate within host HRMO's region and division scope
 */
export async function inviteCollaborator(req, res) {
  try {
    const hostHrmoId = req.user?.id || req.user?.userId;
    if (!hostHrmoId) {
      return res.status(401).json({ error: 'Unauthorized: Missing host user identification' });
    }

    // 1. Validate payload
    const validation = CollaboratorInviteSchema.validate(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors[0] || 'Invalid collaborator data provided.',
        errors: validation.errors
      });
    }

    const { first_name, last_name, position, email } = validation.data;

    // 2. Derive region and division scope directly from host user
    const regionId = req.user?.region_id || req.user?.region || 'NCR';
    const divisionId = req.user?.division_id || req.user?.division || 'BHROD';

    // 3. Prevent duplicate invitation under the same host
    const existing = await pool.query(`
      SELECT id FROM collaborators
      WHERE host_hrmo_id = $1 AND LOWER(email) = LOWER($2);
    `, [hostHrmoId, email]);

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: `A collaborator with email "${email}" has already been invited by you.`
      });
    }

    // 4. Insert into database
    const insertRes = await pool.query(`
      INSERT INTO collaborators (
        first_name, 
        last_name, 
        position, 
        email, 
        region_id, 
        division_id, 
        host_hrmo_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id, 
        first_name, 
        last_name, 
        position, 
        email, 
        region_id, 
        division_id, 
        host_hrmo_id, 
        created_at;
    `, [first_name, last_name, position, email, regionId, divisionId, hostHrmoId]);

    const newCollaborator = insertRes.rows[0];

    return res.status(201).json({
      success: true,
      collaborator: newCollaborator,
      message: 'Collaborator invited successfully'
    });
  } catch (err) {
    console.error('[Collaborators Controller] inviteCollaborator error:', err);
    return res.status(500).json({ error: err.message || 'Failed to invite collaborator' });
  }
}

/**
 * DELETE /api/collaborators/:id
 * Removes a collaborator record owned by the authenticated HRMO host
 */
export async function deleteCollaborator(req, res) {
  try {
    const hostHrmoId = req.user?.id || req.user?.userId;
    if (!hostHrmoId) {
      return res.status(401).json({ error: 'Unauthorized: Missing host user identification' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Collaborator ID is required.' });
    }

    // Parameterized delete enforcing host_hrmo_id match to prevent cross-account deletions
    const deleteRes = await pool.query(`
      DELETE FROM collaborators
      WHERE id = $1 AND host_hrmo_id = $2
      RETURNING id;
    `, [id, hostHrmoId]);

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({
        error: 'Collaborator not found or not authorized to delete.'
      });
    }

    return res.json({
      success: true,
      message: 'Collaborator removed successfully'
    });
  } catch (err) {
    console.error('[Collaborators Controller] deleteCollaborator error:', err);
    return res.status(500).json({ error: 'Failed to delete collaborator' });
  }
}
