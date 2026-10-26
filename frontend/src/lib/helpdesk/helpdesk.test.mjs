import test from "node:test";
import assert from "node:assert/strict";
import {
  getStatusBadgeConfig,
  getPriorityBadgeConfig,
  getAllowedStatusTransitions,
  buildCreateTicketPayload,
  formatDelayMinutes,
  CATEGORIES,
  ORIGINS,
  PRIORITIES,
  STATUSES,
} from "./constants.ts";

test("constants defines all 6 categories, 6 origins, and 4 priorities", () => {
  assert.equal(CATEGORIES.length, 6);
  assert.ok(CATEGORIES.some((c) => c.value === "HARDWARE"));
  assert.ok(CATEGORIES.some((c) => c.value === "SOFTWARE"));
  assert.ok(CATEGORIES.some((c) => c.value === "NETWORK"));
  assert.ok(CATEGORIES.some((c) => c.value === "ACCESS"));
  assert.ok(CATEGORIES.some((c) => c.value === "EMAIL"));
  assert.ok(CATEGORIES.some((c) => c.value === "OTHER"));

  assert.equal(ORIGINS.length, 6);
  assert.ok(ORIGINS.some((o) => o.value === "WHATSAPP"));
  assert.ok(ORIGINS.some((o) => o.value === "PHONE"));
  assert.ok(ORIGINS.some((o) => o.value === "DIRECT"));

  assert.equal(PRIORITIES.length, 4);
  assert.deepEqual(
    PRIORITIES.map((p) => p.value),
    ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
  );
});

test("buildCreateTicketPayload strips any injected created_by or ticket_number", () => {
  const dirtyInput = {
    requesterEmployeeId: 10,
    reportedAt: "2026-10-26T08:00:00Z",
    category: "HARDWARE",
    origin: "WHATSAPP",
    priority: "HIGH",
    title: "Monitor berkedip",
    description: "Layar monitor bergaris garis sejak pagi",
    assetId: 5,
    isInternal: false,
    created_by: 999,
    createdBy: 999,
    ticketNumber: "TCK-202610-9999",
    ticket_number: "TCK-202610-9999",
    status: "CLOSED",
  };

  const payload = buildCreateTicketPayload(dirtyInput);
  assert.equal(payload.requesterEmployeeId, 10);
  assert.equal(payload.title, "Monitor berkedip");
  assert.equal(payload.category, "HARDWARE");
  assert.equal(payload.origin, "WHATSAPP");
  assert.equal(payload.priority, "HIGH");
  assert.equal(payload.isInternal, false);
  assert.equal(payload.assetId, 5);

  // Security check: client must never be able to inject these fields
  assert.equal(payload.created_by, undefined);
  assert.equal(payload.createdBy, undefined);
  assert.equal(payload.ticketNumber, undefined);
  assert.equal(payload.ticket_number, undefined);
  assert.equal(payload.status, undefined);
});

test("getStatusBadgeConfig returns Emerald Enterprise token classes", () => {
  const openBadge = getStatusBadgeConfig("OPEN");
  assert.ok(openBadge.bgClass.includes("blue"));
  assert.ok(openBadge.textClass.includes("blue"));
  assert.equal(openBadge.label, "Open");

  const resolvedBadge = getStatusBadgeConfig("RESOLVED");
  assert.ok(resolvedBadge.bgClass.includes("emerald"));
  assert.ok(resolvedBadge.textClass.includes("emerald"));
  assert.equal(resolvedBadge.label, "Selesai");

  const inProgressBadge = getStatusBadgeConfig("IN_PROGRESS");
  assert.ok(inProgressBadge.bgClass.includes("amber"));
  assert.ok(inProgressBadge.textClass.includes("amber"));

  const pendingBadge = getStatusBadgeConfig("PENDING");
  assert.ok(pendingBadge.bgClass.includes("purple"));
  assert.ok(pendingBadge.textClass.includes("purple"));
});

test("getPriorityBadgeConfig returns proper severity styles", () => {
  const critical = getPriorityBadgeConfig("CRITICAL");
  assert.ok(critical.bgClass.includes("rose"));
  assert.ok(critical.textClass.includes("rose"));
  assert.equal(critical.label, "Kritis");

  const low = getPriorityBadgeConfig("LOW");
  assert.ok(low.bgClass.includes("slate"));
  assert.equal(low.label, "Rendah");
});

test("getAllowedStatusTransitions strictly matches domain workflow", () => {
  assert.deepEqual(getAllowedStatusTransitions("OPEN"), ["IN_PROGRESS", "CANCELLED"]);
  assert.deepEqual(getAllowedStatusTransitions("IN_PROGRESS"), ["PENDING", "RESOLVED", "CANCELLED"]);
  assert.deepEqual(getAllowedStatusTransitions("PENDING"), ["IN_PROGRESS", "CANCELLED"]);
  assert.deepEqual(getAllowedStatusTransitions("RESOLVED"), ["CLOSED", "IN_PROGRESS"]);
  assert.deepEqual(getAllowedStatusTransitions("CLOSED"), ["IN_PROGRESS"]);
  assert.deepEqual(getAllowedStatusTransitions("CANCELLED"), []);
});

test("formatDelayMinutes formats delay between reported_at and created_at correctly", () => {
  assert.equal(formatDelayMinutes(0), "Tepat waktu");
  assert.equal(formatDelayMinutes(5), "5 menit");
  assert.equal(formatDelayMinutes(125), "2 jam 5 mnt");
  assert.equal(formatDelayMinutes(1500), "1 hari 1 jam");
});
