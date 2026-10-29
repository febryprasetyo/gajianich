import { Router } from 'express';
import {
  getTicketCategories,
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  addTicketComment,
} from '../controllers/ticketController';
import { authenticateToken, requirePermission } from '../middleware/auth';
import {requireOrganizationScope} from '../middleware/organizationScope';

const router = Router();

// Protect all ticket routes with authentication
router.use(authenticateToken);
router.use(requireOrganizationScope('assets','read'));

const viewTickets = requirePermission('tickets.view');
const createTickets = requirePermission('tickets.create');
const manageTickets = requirePermission('tickets.manage');

// --- Ticket Categories ---
router.get('/categories', viewTickets, getTicketCategories);

// --- IT Tickets CRUD & Comments ---
router.get('/', viewTickets, getTickets);
router.get('/:id', viewTickets, getTicketById);
router.post('/', createTickets, createTicket);
router.put('/:id', manageTickets, updateTicket);
router.post('/:id/comments', viewTickets, addTicketComment);

export default router;
