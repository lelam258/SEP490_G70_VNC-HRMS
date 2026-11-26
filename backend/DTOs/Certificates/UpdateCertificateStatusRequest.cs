using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Certificates;

public sealed record UpdateCertificateStatusRequest(
    [Required] string Status
);
