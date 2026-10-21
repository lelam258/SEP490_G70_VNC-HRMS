export type CurrentUser = { id: string; username: string; name: string; email: string | null; role: string };
export type Session = { accessToken: string; expiresAt: string; user: CurrentUser };
export type RecoveryChallenge = { challengeId: string; otpLength: number; expiresAt: string; maxAttempts: number; message: string };
export type StoredRecovery = RecoveryChallenge & { email: string; resendAvailableAt: number };
