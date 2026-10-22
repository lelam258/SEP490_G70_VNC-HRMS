using Microsoft.AspNetCore.Mvc;
namespace Vnc.HRMS.Controllers;
[ApiController, ApiExplorerSettings(IgnoreApi = true), Route("health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet] public IActionResult Get() => Ok(new { status = "ok", application = "VNC HRMS API" });
}
