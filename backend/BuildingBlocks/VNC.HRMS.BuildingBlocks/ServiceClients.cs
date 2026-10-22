using System.Net;
using System.Net.Http.Json;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Contracts;
using Vnc.HRMS.DTOs.Auth;
namespace Vnc.HRMS;
public static class ServiceClients
{
    public static void Configure(HttpClient client, IConfiguration config, string name)
    {
        client.BaseAddress = new Uri(config[$"Services:{name}"] ?? throw new InvalidOperationException($"Missing Services:{name}"));
        client.Timeout = TimeSpan.FromSeconds(10);
        var key = config["InternalApi:Key"] ?? "";
        if (key.Length < 32) throw new InvalidOperationException("InternalApi:Key must contain at least 32 characters.");
        client.DefaultRequestHeaders.Add("X-Internal-Key", key);
    }
    public static async Task<T?> ReadAsync<T>(HttpClient client, HttpRequestMessage request, CancellationToken ct)
    {
        using var requestLifetime = request;
        try
        {
            using var response = await client.SendAsync(request, ct);
            if (response.StatusCode == HttpStatusCode.NotFound) return default;
            if (!response.IsSuccessStatusCode) throw new AppException(503, "Dịch vụ liên quan chưa sẵn sàng.");
            return await response.Content.ReadFromJsonAsync<T>(cancellationToken: ct);
        }
        catch (HttpRequestException) { throw new AppException(503, "Không kết nối được dịch vụ liên quan."); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new AppException(503, "Dịch vụ liên quan phản hồi quá chậm."); }
    }
}
public sealed class EmployeeDirectoryClient(HttpClient client) : IEmployeeDirectory
{
    public async Task<AccountEmployeeOption[]> ListAccountOptionsAsync(CancellationToken ct) =>
        await ServiceClients.ReadAsync<AccountEmployeeOption[]>(client, new(HttpMethod.Get, "internal/employees/account-options"), ct) ?? [];
    public Task<EmployeeIdentity?> FindAsync(Guid id, CancellationToken ct) => ServiceClients.ReadAsync<EmployeeIdentity>(client, new(HttpMethod.Get, $"internal/employees/{id}"), ct);
    public Task<EmployeeIdentity?> FindForRegistrationAsync(string code, string email, CancellationToken ct) => ServiceClients.ReadAsync<EmployeeIdentity>(client,
        new(HttpMethod.Post, "internal/employees/registration-lookup") { Content = JsonContent.Create(new RegistrationLookup(code, email)) }, ct);
}
public sealed class SessionInspectorClient(HttpClient client) : ISessionInspector
{
    public Task<SessionIdentityDto?> InspectAsync(Guid id, CancellationToken ct) => ServiceClients.ReadAsync<SessionIdentityDto>(client, new(HttpMethod.Get, $"internal/sessions/{id}"), ct);
}
