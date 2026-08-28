import { createHmac, timingSafeEqual } from "node:crypto";

/** How long one unlock stays valid. Short enough that a leaked token expires on its own. */
export const DEVELOPER_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
/** Failed attempts tolerated inside one window before the endpoint stops answering. */
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 60_000;
/** Domain separation, so the signing key can never be confused with the password itself. */
const KEY_LABEL = "studispace/developer-mode/v1";

/**
 * A string discriminant rather than a boolean one: this project compiles without
 * `strictNullChecks`, where narrowing on a literal `true`/`false` does not hold.
 */
export type UnlockResult =
  | { status: "unlocked"; token: string; expiresAt: number }
  | { status: "unconfigured" }
  | { status: "invalid" }
  | { status: "throttled" };

export interface DeveloperMode {
  /** False when the server has no DEVELOPER_MODE_PASSWORD; every unlock then fails closed. */
  readonly configured: boolean;
  unlock(password: unknown): UnlockResult;
  verify(token: unknown): boolean;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Constant-time equality over fixed-width digests, so length never leaks either. */
function digestsMatch(a: string, b: string, key: string): boolean {
  const left = createHmac("sha256", key).update(a).digest();
  const right = createHmac("sha256", key).update(b).digest();
  return timingSafeEqual(left, right);
}

/**
 * Developer Mode authorization.
 *
 * The password lives only in the server environment. The browser posts a
 * candidate, and on success receives an opaque HMAC-signed token carrying
 * nothing but an expiry — so the password itself is never echoed back, never
 * stored by the client, and cannot be recovered from a captured token.
 *
 * The signing key is derived from the password rather than generated per
 * process, so tokens stay valid across a restart and across replicas without
 * introducing a second secret to manage. Rotating the password invalidates
 * every outstanding token, which is the behaviour you want from a rotation.
 */
export function createDeveloperMode(env: NodeJS.ProcessEnv = process.env, now: () => number = Date.now): DeveloperMode {
  const password = (env.DEVELOPER_MODE_PASSWORD ?? "").trim();
  const configured = password.length > 0;
  const signingKey = configured ? createHmac("sha256", KEY_LABEL).update(password).digest("hex") : "";

  // Process-local brute-force brake. Not a substitute for a strong password;
  // it just makes an online guessing run impractical.
  let failures = 0;
  let windowStartedAt = 0;

  const sign = (payload: string) => createHmac("sha256", signingKey).update(payload).digest("base64url");

  return {
    configured,

    unlock(candidate: unknown): UnlockResult {
      if (!configured) return { status: "unconfigured" };
      const at = now();
      if (at - windowStartedAt > ATTEMPT_WINDOW_MS) {
        failures = 0;
        windowStartedAt = at;
      }
      if (failures >= MAX_ATTEMPTS) return { status: "throttled" };
      if (typeof candidate !== "string" || !digestsMatch(candidate, password, signingKey)) {
        failures += 1;
        return { status: "invalid" };
      }
      failures = 0;
      const expiresAt = at + DEVELOPER_TOKEN_TTL_MS;
      const payload = base64url(JSON.stringify({ exp: expiresAt }));
      return { status: "unlocked", token: `v1.${payload}.${sign(payload)}`, expiresAt };
    },

    verify(token: unknown): boolean {
      if (!configured || typeof token !== "string") return false;
      const [version, payload, signature] = token.split(".");
      if (version !== "v1" || !payload || !signature) return false;
      // Compare through HMAC digests: equal length, constant time, no early exit.
      if (!digestsMatch(signature, sign(payload), signingKey)) return false;
      try {
        const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return typeof exp === "number" && now() < exp;
      } catch {
        return false;
      }
    },
  };
}
