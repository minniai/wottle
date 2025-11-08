import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Stub server-only module for tests that import server-side utilities.
vi.mock("server-only", () => ({}));
