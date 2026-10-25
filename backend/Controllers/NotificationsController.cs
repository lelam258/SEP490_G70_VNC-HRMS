using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Services;
namespace Vnc.HRMS.Controllers;
[ApiController, Authorize, Route("api/notifications")]
public sealed class NotificationsController(NotificationService service) : ControllerBase
{
    [HttpGet] public Task<object> List([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.ListAsync(Guid.Parse(User.FindFirstValue("sub")!), page, pageSize, ct);
    [HttpPut("{id:guid}/read")] public async Task<IActionResult> Read(Guid id, CancellationToken ct) => await service.ReadAsync(Guid.Parse(User.FindFirstValue("sub")!), id, ct) ? NoContent() : NotFound();
}
