namespace Vnc.HRMS.Common.Exceptions;

public sealed class AppException(int statusCode, string message, string? field = null) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string? Field { get; } = field;
}
