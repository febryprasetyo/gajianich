import { test } from "node:test";
import assert from "node:assert";
import { calculateHaversineDistance, isWithinGeofence, buildMapLinks } from "./geofence";

test("calculateHaversineDistance returns 0 for identical coordinates", () => {
  const dist = calculateHaversineDistance(-6.2088, 106.8456, -6.2088, 106.8456);
  assert.strictEqual(dist, 0);
});

test("calculateHaversineDistance calculates accurate distance in meters", () => {
  // Monas (-6.175392, 106.827153) to Bundaran HI (-6.194957, 106.823126) is approximately 2.2 km (~2200m)
  const dist = calculateHaversineDistance(-6.175392, 106.827153, -6.194957, 106.823126);
  assert.ok(dist >= 2100 && dist <= 2300, `Distance should be around 2200m, got ${dist}`);
});

test("isWithinGeofence identifies inside vs outside office radius", () => {
  const officeLat = -6.2088;
  const officeLon = 106.8456;
  const radius = 100;

  // 10 meters away
  const inside = isWithinGeofence(-6.20885, 106.84565, officeLat, officeLon, radius);
  assert.strictEqual(inside.isWithin, true);
  assert.ok(inside.distanceMeters !== null && inside.distanceMeters <= 50);

  // 500 meters away
  const outside = isWithinGeofence(-6.2130, 106.8456, officeLat, officeLon, radius);
  assert.strictEqual(outside.isWithin, false);
  assert.ok(outside.distanceMeters !== null && outside.distanceMeters > 400);

  // Missing coordinates returns outside geofence with null distance
  const missing = isWithinGeofence(null, null, officeLat, officeLon, radius);
  assert.strictEqual(missing.isWithin, false);
  assert.strictEqual(missing.distanceMeters, null);
});

test("buildMapLinks formats valid OpenStreetMap and Google Maps links", () => {
  const links = buildMapLinks(-6.2088, 106.8456);
  assert.strictEqual(
    links.osmUrl,
    "https://www.openstreetmap.org/?mlat=-6.2088&mlon=106.8456#map=17/-6.2088/106.8456"
  );
  assert.strictEqual(
    links.googleMapsUrl,
    "https://www.google.com/maps?q=-6.2088,106.8456"
  );
});
