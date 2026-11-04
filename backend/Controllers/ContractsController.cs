using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize(Policy = "HRManager"), Route("api/contracts")]
public sealed class ContractsController(IContractService contracts) : ControllerBase
{
    [HttpGet] public Task<ContractListItemDto[]> List(CancellationToken ct) => contracts.ListAsync(ct);

    [HttpGet("{id:guid}")] public Task<ContractDetailDto> Get(Guid id, CancellationToken ct) => contracts.GetAsync(id, ct);

    [HttpPost]
    public async Task<ActionResult<ContractDetailDto>> Create(CreateContractRequest request, CancellationToken ct)
    {
        var contract = await contracts.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = contract.ContractId }, contract);
    }

    [HttpPut("{id:guid}")]
    public Task<ContractDetailDto> Update(Guid id, UpdateContractRequest request, CancellationToken ct)
        => contracts.UpdateAsync(id, request, ct);
}
