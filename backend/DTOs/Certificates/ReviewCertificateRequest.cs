using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Certificates;

public sealed record ReviewCertificateRequest(
    [Required(ErrorMessage = "Hành động thẩm định (approve/reject) là bắt buộc.")]
    string Action,
    string? RejectionReason = null
);
