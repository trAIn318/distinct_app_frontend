import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(""),
}));

const loginApi = vi.fn();
const verifyLoginOtpApi = vi.fn();
vi.mock("../../../lib/api", () => ({
  loginApi: (...a) => loginApi(...a),
  verifyLoginOtpApi: (...a) => verifyLoginOtpApi(...a),
}));

const saveSession = vi.fn();
vi.mock("../../../lib/session", () => ({
  saveSession: (...a) => saveSession(...a),
}));

vi.mock("../../../lib/preferences", () => ({
  loadServerPreferences: () => Promise.resolve(null),
}));

import LoginForm from "../LoginForm";

afterEach(cleanup);
beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  loginApi.mockReset();
  verifyLoginOtpApi.mockReset();
  saveSession.mockReset();
});

function fillAndSubmit(id = "user", pwd = "secret123") {
  fireEvent.change(screen.getByLabelText(/email or username/i), {
    target: { value: id },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: pwd },
  });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginForm — non-token 200 responses", () => {
  it("saves the session and redirects on a normal token login", async () => {
    loginApi.mockResolvedValue({ access: "a", refresh: "r", user: { id: 1 } });
    render(<LoginForm />);
    fillAndSubmit();
    await waitFor(() =>
      expect(saveSession).toHaveBeenCalledWith(
        expect.objectContaining({ access: "a", refresh: "r" })
      )
    );
    expect(push).toHaveBeenCalledWith("/");
  });

  it("redirects to the reset flow when the password is expired (no silent home)", async () => {
    loginApi.mockResolvedValue({
      password_expired: true,
      email: "user@example.com",
    });
    render(<LoginForm />);
    fillAndSubmit();
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        expect.stringContaining("/forgot-password")
      )
    );
    expect(push.mock.calls[0][0]).toContain("expired=1");
    expect(push.mock.calls[0][0]).toContain("user%40example.com");
    // No debe quedar "logueado" sin token
    expect(saveSession).not.toHaveBeenCalled();
  });

  it("shows an OTP step when the account requires inactivity OTP", async () => {
    loginApi.mockResolvedValue({ requires_otp: true, channel: "email" });
    render(<LoginForm />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByLabelText(/code/i)).toBeInTheDocument()
    );
    // No session yet, no silent redirect home
    expect(saveSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("completes login after a valid OTP", async () => {
    loginApi.mockResolvedValue({ requires_otp: true, channel: "email" });
    verifyLoginOtpApi.mockResolvedValue({
      access: "a",
      refresh: "r",
      user: { id: 1 },
    });
    render(<LoginForm />);
    fillAndSubmit("user", "secret123");
    const otpInput = await screen.findByLabelText(/code/i);
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));
    await waitFor(() =>
      expect(saveSession).toHaveBeenCalledWith(
        expect.objectContaining({ access: "a" })
      )
    );
    expect(verifyLoginOtpApi).toHaveBeenCalledWith("user", "123456");
    expect(push).toHaveBeenCalledWith("/");
  });
});
