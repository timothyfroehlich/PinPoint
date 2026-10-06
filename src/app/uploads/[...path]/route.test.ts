import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_BYTES = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

let projectDir: string;
let uploadsDir: string;

function get(segments: string[]): Promise<Response> {
  return GET(new Request(`http://localhost/uploads/${segments.join("/")}`), {
    params: Promise.resolve({ path: segments }),
  });
}

function stubMockStorageDevelopment(): void {
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("MOCK_BLOB_STORAGE", "");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
}

describe("GET /uploads/[...path] (mock blob storage)", () => {
  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "mock-uploads-"));
    uploadsDir = path.join(projectDir, "public", "uploads");
    await fs.mkdir(path.join(uploadsDir, "issue-images", "pending"), {
      recursive: true,
    });
    vi.spyOn(process, "cwd").mockReturnValue(projectDir);
    stubMockStorageDevelopment();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  it.each([
    ["photo.png", PNG_BYTES, "image/png"],
    ["photo.jpg", JPEG_BYTES, "image/jpeg"],
    ["photo.webp", WEBP_BYTES, "image/webp"],
  ])("serves %s with the type its bytes declare", async (name, bytes, type) => {
    await fs.writeFile(
      path.join(uploadsDir, "issue-images", "pending", name),
      bytes
    );

    const response = await get(["issue-images", "pending", name]);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(type);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it("serves under a production build run as a development deployment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("MOCK_BLOB_STORAGE", "true");
    await fs.writeFile(path.join(uploadsDir, "a.png"), PNG_BYTES);

    const response = await get(["a.png"]);

    expect(response.status).toBe(200);
  });

  it("is refused on the production deployment even with mock storage forced", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MOCK_BLOB_STORAGE", "true");
    await fs.writeFile(path.join(uploadsDir, "a.png"), PNG_BYTES);

    const response = await get(["a.png"]);

    expect(response.status).toBe(404);
  });

  it("is refused when uploads go to real blob storage", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_token");
    await fs.writeFile(path.join(uploadsDir, "a.png"), PNG_BYTES);

    const response = await get(["a.png"]);

    expect(response.status).toBe(404);
  });

  it("does not serve a file whose bytes are not an allowed image", async () => {
    await fs.writeFile(
      path.join(uploadsDir, "evil.png"),
      "<script>alert(1)</script>"
    );

    const response = await get(["evil.png"]);

    expect(response.status).toBe(404);
  });

  it.each([
    [[".."]],
    [["..", "secret.png"]],
    [["issue-images", "..", "..", "secret.png"]],
    [["%2e%2e", "secret.png"]],
    [["a/../../secret.png"]],
    [[]],
  ])("refuses the traversal path %j", async (segments) => {
    await fs.writeFile(
      path.join(projectDir, "public", "secret.png"),
      PNG_BYTES
    );

    const response = await get(segments);

    expect(response.status).toBe(404);
  });

  it("refuses a symlink that leaves the uploads directory", async () => {
    const outside = path.join(projectDir, "outside.png");
    await fs.writeFile(outside, PNG_BYTES);
    await fs.symlink(outside, path.join(uploadsDir, "link.png"));

    const response = await get(["link.png"]);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a missing file or directory", async () => {
    expect((await get(["missing.png"])).status).toBe(404);
    expect((await get(["issue-images"])).status).toBe(404);
  });
});
