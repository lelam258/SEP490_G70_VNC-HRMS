using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Repositories.Interfaces;
namespace Vnc.HRMS.Controllers;
[ApiController, ApiExplorerSettings(IgnoreApi = true), Route("internal/sessions")]
public sealed class InternalSessionsController(IAuthRepository auth) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var session = await auth.InspectSessionAsync(id, ct);
        return session is null ? NotFound() : Ok(session);
    }
}
