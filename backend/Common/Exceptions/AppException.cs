namespace Vnc.HRMS.Common.Exceptions;

public sealed class AppException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
