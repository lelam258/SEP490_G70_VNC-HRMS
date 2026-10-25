using System.ComponentModel.DataAnnotations;
namespace Vnc.HRMS.DTOs.Organization;
public sealed record UpdateDepartmentRequest(
    [Required, StringLength(20)] string Code,
    [Required, StringLength(100)] string Name,
    [Required, RegularExpression("^(active|inactive)$")] string Status);
