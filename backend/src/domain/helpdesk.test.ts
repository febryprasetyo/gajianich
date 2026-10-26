import test from "node:test";
import assert from "node:assert/strict";
import {
  CreateTicketSchema,
  UpdateTicketSchema,
  ALLOWED_STATUS_TRANSITIONS,
  TicketStatus
} from "./helpdesk";

export function validateStatusTransition(current: TicketStatus, next: TicketStatus): void {
  if (current === next) return;
  const allowed = ALLOWED_STATUS_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Transisi status dari ${current} ke ${next} tidak valid`);
  }
}

test("Helpdesk domain transition rules", async (t) => {
  await t.test("allows valid status transitions", () => {
    assert.doesNotThrow(() => validateStatusTransition("OPEN", "IN_PROGRESS"));
    assert.doesNotThrow(() => validateStatusTransition("OPEN", "RESOLVED"));
    assert.doesNotThrow(() => validateStatusTransition("OPEN", "CLOSED"));
    assert.doesNotThrow(() => validateStatusTransition("IN_PROGRESS", "PENDING"));
    assert.doesNotThrow(() => validateStatusTransition("IN_PROGRESS", "RESOLVED"));
    assert.doesNotThrow(() => validateStatusTransition("RESOLVED", "OPEN"));
    assert.doesNotThrow(() => validateStatusTransition("RESOLVED", "CLOSED"));
    assert.doesNotThrow(() => validateStatusTransition("CLOSED", "OPEN"));
  });

  await t.test("rejects invalid status transitions", () => {
    assert.throws(() => validateStatusTransition("OPEN", "PENDING"), /tidak valid/);
    assert.throws(() => validateStatusTransition("CLOSED", "IN_PROGRESS"), /tidak valid/);
    assert.throws(() => validateStatusTransition("CLOSED", "RESOLVED"), /tidak valid/);
    assert.throws(() => validateStatusTransition("PENDING", "OPEN"), /tidak valid/);
  });

  await t.test("CreateTicketSchema validates required fields and types", () => {
    const valid = {
      title: "Printer Rusak di Lantai 2",
      description: "Kertas tersangkut terus dan mengeluarkan asap",
      priority: "HIGH",
      category: "PRINTER",
      origin: "PHONE",
      requesterEmployeeId: 12,
    };
    const parsed = CreateTicketSchema.safeParse(valid);
    assert.ok(parsed.success);

    // Rejects empty title
    const invalidTitle = CreateTicketSchema.safeParse({ ...valid, title: "ab" });
    assert.equal(invalidTitle.success, false);

    // Rejects invalid category
    const invalidCat = CreateTicketSchema.safeParse({ ...valid, category: "NOT_EXIST" });
    assert.equal(invalidCat.success, false);
  });

  await t.test("UpdateTicketSchema validates feedbackSource is STAFF_RECORDED only", () => {
    const invalidFeedback = UpdateTicketSchema.safeParse({
      feedbackScore: 5,
      feedbackSource: "CUSTOMER_SURVEY", // invalid
    });
    assert.equal(invalidFeedback.success, false);

    const validFeedback = UpdateTicketSchema.safeParse({
      feedbackScore: 4,
      feedbackSource: "STAFF_RECORDED",
    });
    assert.ok(validFeedback.success);
  });
});
