import { Router } from "express";
import { authenticateToken, requirePermission } from "../../middleware/auth";
import {
  createTicketHandler,
  listTicketsHandler,
  getTicketDetailHandler,
  updateTicketHandler,
  addCommentHandler,
  getTicketAuditHandler,
  searchEmployeesHandler,
  searchAssigneesHandler
} from "./controller";
import {
  handleAttachmentUpload,
  uploadAttachment,
  downloadAttachment
} from "./attachment";

const router = Router();

// Semua rute helpdesk memerlukan otentikasi JWT
router.use(authenticateToken);

const viewHelpdesk = requirePermission(["helpdesk.view", "helpdesk.manage", "super_admin"]);
const manageHelpdesk = requirePermission(["helpdesk.manage", "super_admin"]);

// Lookup endpoints
router.get("/employees", manageHelpdesk, searchEmployeesHandler);
router.get("/assignees", manageHelpdesk, searchAssigneesHandler);

// CRUD Tiket
router.post("/tickets", manageHelpdesk, createTicketHandler);
router.get("/tickets", viewHelpdesk, listTicketsHandler);
router.get("/tickets/:id", viewHelpdesk, getTicketDetailHandler);
router.patch("/tickets/:id", manageHelpdesk, updateTicketHandler);

// Komentar & Audit
router.post("/tickets/:id/comments", manageHelpdesk, addCommentHandler);
router.get("/tickets/:id/audit", manageHelpdesk, getTicketAuditHandler);

// Lampiran File
router.post("/tickets/:id/attachments", manageHelpdesk, handleAttachmentUpload, uploadAttachment);
router.get("/tickets/:id/attachments/:attachmentId", viewHelpdesk, downloadAttachment);

export default router;
