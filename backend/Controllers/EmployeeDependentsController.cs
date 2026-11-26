using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize(Policy = "HRManager"), Route("api/employees/{staffId:guid}/dependents")]
public sealed class EmployeeDependentsController(IEmployeeDependentService dependents) : ControllerBase
{
    [HttpGet]
    public Task<EmployeeDependentDto[]> List(Guid staffId, CancellationToken ct)
        => dependents.ListByStaffAsync(staffId, ct);

    [HttpPost]
    public Task<EmployeeDependentDto> Create(Guid staffId, CreateEmployeeDependentRequest request, CancellationToken ct)
        => dependents.CreateAsync(staffId, request, GetCurrentUserId(), ct);

    [HttpPut("{staffDependentId:guid}")]
    public Task<EmployeeDependentDto> Update(Guid staffId, Guid staffDependentId, UpdateEmployeeDependentRequest request, CancellationToken ct)
        => dependents.UpdateAsync(staffId, staffDependentId, request, ct);

    [HttpPost("{staffDependentId:guid}/documents")]
    public Task<DependentDocumentDto> AddDocument(Guid staffId, Guid staffDependentId, CreateDependentDocumentRequest request, CancellationToken ct)
        => dependents.AddDocumentAsync(staffId, staffDependentId, request, ct);

    [HttpPatch("{staffDependentId:guid}/documents/{documentId:guid}/verify")]
    public Task<DependentDocumentDto> VerifyDocument(
        Guid staffId,
        Guid staffDependentId,
        Guid documentId,
        VerifyDependentDocumentRequest request,
        CancellationToken ct)
        => dependents.VerifyDocumentAsync(staffId, staffDependentId, documentId, request, GetCurrentUserId(), ct);

    [HttpDelete("{staffDependentId:guid}/documents/{documentId:guid}")]
    public async Task<IActionResult> DeleteDocument(
        Guid staffId,
        Guid staffDependentId,
        Guid documentId,
        CancellationToken ct)
    {
        await dependents.DeleteDocumentAsync(staffId, staffDependentId, documentId, ct);
        return NoContent();
    }

    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(sub, out var userId))
            throw new AppException(401, "Không xác định được tài khoản đăng nhập.");
        return userId;
    }
}
