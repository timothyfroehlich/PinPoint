import { describe, it, expect } from "vitest";
import regionLmxFixture from "./fixtures/region-austin-lmxes.json";
import regionLocationFixture from "./fixtures/region-austin-locations.json";
import { parseCatalog, parseRegionLmxes, parseRegionLocations } from "./parse";

describe("parseCatalog image metadata", () => {
  it("accepts the OPDB image URL and dimensions from Pinball Map", () => {
    const [machine] = parseCatalog({
      machines: [
        {
          id: 7,
          name: "Godzilla (Premium)",
          opdb_img: "https://img.opdb.org/example-medium.jpg",
          opdb_img_width: 640,
          opdb_img_height: 445,
        },
      ],
    });

    expect(machine).toMatchObject({
      opdbImageUrl: "https://img.opdb.org/example-medium.jpg",
      opdbImageWidth: 640,
      opdbImageHeight: 445,
    });
  });

  it("discards non-OPDB image origins and invalid dimensions", () => {
    const [machine] = parseCatalog([
      {
        id: 8,
        name: "Unknown",
        opdb_img: "https://example.org/image.jpg",
        opdb_img_width: -1,
        opdb_img_height: "445",
      },
    ]);

    expect(machine).toMatchObject({
      opdbImageUrl: null,
      opdbImageWidth: null,
      opdbImageHeight: null,
    });
  });
});

/**
 * Contract tests for the region readers, against CAPTURED REAL PAYLOADS.
 *
 * `fixtures/region-austin-lmxes.json` and `fixtures/region-austin-locations.json`
 * are unmodified responses from PinballMap for the Austin region, captured
 * 2026-08-17 from `GET /region/austin/location_machine_xrefs.json` and
 * `GET /region/austin/locations.json?no_details=1`. Only whitespace differs —
 * they were pretty-printed so the checked-in diff is reviewable, and the repo's
 * formatter owns them from here. No field was added, removed or edited.
 *
 * These captured responses exercise PinPoint's parser against the published
 * wire shape, with exact projection and malformed-entry rejection assertions.
 *
 * Offline by construction (CORE-TEST-006) — the payload is on disk, nothing here
 * reaches pinballmap.com.
 */

describe("parseRegionLmxes against the captured Austin payload", () => {
  const raw = regionLmxFixture.location_machine_xrefs;

  it("parses every entry — zero drops", () => {
    const parsed = parseRegionLmxes(regionLmxFixture);

    expect(parsed).toHaveLength(487);
    // A shrinking parse is how a shape change would reach us. The parser now
    // rejects malformed entries rather than silently turning them into removals.
    expect(parsed).toHaveLength(raw.length);
  });

  it("keeps the three ids and discards the rest", () => {
    const [first] = parseRegionLmxes(regionLmxFixture);

    expect(first).toEqual({
      lmxId: 218250,
      locationId: 26454,
      machineId: 4532,
    });
  });

  it("rejects a malformed entry instead of creating a false absence", () => {
    expect(() =>
      parseRegionLmxes({
        location_machine_xrefs: [
          { id: 1, location_id: 2, machine_id: 3 },
          { id: 4, machine_id: 5 },
        ],
      })
    ).toThrow(/malformed entry at index 1/);
  });

  it("rejects duplicate LMX ids instead of silently deduplicating", () => {
    expect(() =>
      parseRegionLmxes({
        location_machine_xrefs: [
          { id: 1, location_id: 2, machine_id: 3 },
          { id: 1, location_id: 4, machine_id: 5 },
        ],
      })
    ).toThrow(/repeats LMX id 1/);
  });
});

describe("parseRegionLocations against the captured Austin payload", () => {
  it("names every location — 75 of 75", () => {
    const parsed = parseRegionLocations(regionLocationFixture);

    expect(parsed).toHaveLength(75);
    expect(parsed).toHaveLength(regionLocationFixture.locations.length);
    expect(parsed.every((l) => l.name.length > 0)).toBe(true);
  });

  it("can name every location the LMX payload references", () => {
    // The property the alert actually depends on: a venue id with no name falls
    // back to `location #123` in the Discord post.
    const named = new Set(
      parseRegionLocations(regionLocationFixture).map((l) => l.locationId)
    );
    const referenced = new Set(
      parseRegionLmxes(regionLmxFixture).map((e) => e.locationId)
    );

    expect([...referenced].filter((id) => !named.has(id))).toEqual([]);
  });

  it("ignores the fields `no_details=1` still returns", () => {
    // `no_details` strips the heavy nested content, NOT the scalar columns: each
    // row still arrives with ~20 fields (city, lat, machine_count, …). We read
    // two of them, and this pins that the extras stay out of the parsed shape.
    const [first] = parseRegionLocations(regionLocationFixture);

    expect(
      Object.keys(regionLocationFixture.locations[0] ?? {}).length
    ).toBeGreaterThan(2);
    expect(first).toEqual({
      locationId: 29910,
      name: "American Legion J.Q. Adams Post 223",
    });
  });
});

describe("parseCatalog Insider Connected eligibility", () => {
  it("reads ic_eligible, treating anything but true as ineligible", () => {
    const machines = parseCatalog([
      { id: 1, name: "Eligible", ic_eligible: true },
      { id: 2, name: "Ineligible", ic_eligible: false },
      { id: 3, name: "Absent" },
      { id: 4, name: "Odd", ic_eligible: "true" },
    ]);
    expect(machines.map((m) => m.icEligible)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });
});
