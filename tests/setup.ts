import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Stub server-only module for tests that import server-side utilities.
vi.mock("server-only", () => ({}));

// A deterministic signing key for the session cookie (spec 067).
process.env.WOTTLE_SESSION_SECRET ??= "dGVzdC1vbmx5LXdvdHRsZS1zZXNzaW9uLXNlY3JldC0wMTIzNDU2Nzg5YWJjZGVm";
