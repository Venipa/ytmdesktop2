import { describe, expect, it } from "vitest";
import {
	acceleratorDisplayParts,
	acceleratorFromKeyboardEvent,
	duplicateAcceleratorId,
	parseAccelerator,
	validateGlobalAccelerator,
} from "./accelerators";
import { resolveShortcutBinds } from "./catalog";

describe("validateGlobalAccelerator", () => {
	it("accepts the existing media defaults", () => {
		expect(validateGlobalAccelerator("Shift+Alt+Left", "win32").ok).toBe(true);
		expect(validateGlobalAccelerator("Shift+Alt+Space", "darwin").ok).toBe(true);
	});

	it("rejects shift-only and bare keys", () => {
		const shift = validateGlobalAccelerator("Shift+A", "win32");
		expect(shift.ok).toBe(false);
		if (!shift.ok) expect(shift.reason).toMatch(/Ctrl, Alt, or Cmd/);
		const bare = validateGlobalAccelerator("A", "win32");
		expect(bare.ok).toBe(false);
	});

	it("rejects OS reserved combos", () => {
		expect(validateGlobalAccelerator("Alt+F4", "win32").ok).toBe(false);
		expect(validateGlobalAccelerator("Alt+Tab", "linux").ok).toBe(false);
		expect(validateGlobalAccelerator("Super+L", "win32").ok).toBe(false);
		expect(validateGlobalAccelerator("Command+Q", "darwin").ok).toBe(false);
		expect(validateGlobalAccelerator("Command+Space", "darwin").ok).toBe(false);
	});

	it("rejects media keys", () => {
		expect(validateGlobalAccelerator("Alt+MediaPlayPause", "win32").ok).toBe(false);
	});
});

describe("duplicateAcceleratorId", () => {
	it("finds a collision against resolved defaults", () => {
		const resolved = resolveShortcutBinds({});
		const parsed = parseAccelerator("Shift+Alt+Left");
		expect(parsed).not.toBeNull();
		expect(duplicateAcceleratorId(parsed!, resolved, "win32", "next")).toBe("prev");
		expect(duplicateAcceleratorId(parsed!, resolved, "win32", "prev")).toBeNull();
	});
});

describe("acceleratorDisplayParts", () => {
	it("splits modifiers and key", () => {
		expect(acceleratorDisplayParts("Shift+Alt+Left", "win32")).toEqual(["Alt", "Shift", "Left"]);
		expect(acceleratorDisplayParts("CommandOrControl+Alt+K", "darwin")).toEqual(["Cmd", "Option", "K"]);
	});
});

describe("acceleratorFromKeyboardEvent", () => {
	it("maps ctrl on windows to CommandOrControl", () => {
		expect(
			acceleratorFromKeyboardEvent(
				{ key: "K", code: "KeyK", ctrlKey: true, altKey: true, shiftKey: false, metaKey: false },
				"win32",
			),
		).toBe("CommandOrControl+Alt+K");
	});
});
