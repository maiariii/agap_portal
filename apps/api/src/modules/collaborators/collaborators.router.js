import { Router } from 'express';
import {
  getCollaborators,
  inviteCollaborator,
  deleteCollaborator
} from './collaborators.controller.js';

const router = Router();

router.get('/', getCollaborators);
router.post('/invite', inviteCollaborator);
router.delete('/:id', deleteCollaborator);

export default router;
