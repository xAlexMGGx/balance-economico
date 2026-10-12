import { randomBytes } from './crypto';

// Face ID through a passkey (WebAuthn) with the PRF extension: on every successful Face ID check,
// the passkey returns the same 32-byte secret for our salt. That secret unwraps the data key, so
// Face ID really unlocks the data instead of just hiding a screen. Needs iOS 18 or later.
// There is no server: the signature is not checked, only the PRF secret matters.

export type FaceIdProblem = 'unsupported' | 'cancelled' | 'failed';

export class FaceIdError extends Error {
  readonly problem: FaceIdProblem;

  constructor(problem: FaceIdProblem) {
    super(problem);
    this.name = 'FaceIdError';
    this.problem = problem;
  }
}

export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'PublicKeyCredential' in window;
}

function toFaceIdError(error: unknown): FaceIdError {
  if (error instanceof FaceIdError) return error;
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
    return new FaceIdError('cancelled');
  }
  return new FaceIdError('failed');
}

/** Asks Face ID for the passkey's secret for this salt. */
export async function getPrfSecret(credentialId: Uint8Array, prfSalt: Uint8Array): Promise<ArrayBuffer> {
  try {
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: 'public-key', id: new Uint8Array(credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: { prf: { eval: { first: new Uint8Array(prfSalt) } } },
      },
    })) as PublicKeyCredential | null;
    const secret = credential?.getClientExtensionResults().prf?.results?.first;
    if (!secret) throw new FaceIdError('unsupported');
    return secret instanceof ArrayBuffer ? secret : new Uint8Array(secret.buffer, secret.byteOffset, secret.byteLength).slice().buffer;
  } catch (error) {
    throw toFaceIdError(error);
  }
}

/** Creates the passkey (iOS asks to save it with Face ID) and returns its secret. */
export async function registerPasskey(): Promise<{ credentialId: Uint8Array; prfSalt: Uint8Array; secret: ArrayBuffer }> {
  if (!isPasskeySupported()) throw new FaceIdError('unsupported');
  const prfSalt = randomBytes(32);
  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: 'Balance' },
        user: { id: randomBytes(16), name: 'Balance', displayName: 'Balance' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'required',
        },
        timeout: 60_000,
        extensions: { prf: { eval: { first: prfSalt } } },
      },
    })) as PublicKeyCredential | null;
  } catch (error) {
    throw toFaceIdError(error);
  }
  if (!credential) throw new FaceIdError('failed');

  const credentialId = new Uint8Array(credential.rawId);
  const prf = credential.getClientExtensionResults().prf;
  if (!prf?.enabled) throw new FaceIdError('unsupported');
  const first = prf.results?.first;
  // Some systems only return the secret when the passkey is used, not when it is created.
  const secret = first
    ? first instanceof ArrayBuffer
      ? first
      : new Uint8Array(first.buffer, first.byteOffset, first.byteLength).slice().buffer
    : await getPrfSecret(credentialId, prfSalt);
  return { credentialId, prfSalt, secret };
}
