using System.ComponentModel.DataAnnotations;
namespace Vnc.HRMS.DTOs.Organization;
public sealed record DepartmentStatusRequest(
    [Required, RegularExpression("^(active|inactive)$")] string Status);
