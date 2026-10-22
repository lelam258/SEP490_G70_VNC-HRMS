namespace Vnc.HRMS.DTOs.Auth;
public sealed record RecoveryChallengeResponse(Guid ChallengeId, int OtpLength, DateTime ExpiresAt, int MaxAttempts, string Message);
