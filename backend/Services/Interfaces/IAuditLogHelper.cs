namespace Vnc.HRMS.Services.Interfaces;

public interface IAuditLogHelper
{
    void Log(string action, string entityType, Guid? entityId, object? oldValue, object? newValue);
}
