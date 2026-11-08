namespace Vnc.HRMS.Models;

public sealed class ScheduleFacility
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
}
// One coverage unit per clinical team or functional machine room at each facility.
public sealed class ScheduleCoverage
{
    public Guid Id { get; set; }
    public Guid FacilityId { get; set; }
    public Guid DepartmentId { get; set; }
    public string Name { get; set; } = "";
}
public sealed class ScheduleWeek
{
    public Guid Id { get; set; }
    public Guid DepartmentId { get; set; }
    public DateOnly Monday { get; set; }
    public bool Published { get; set; }
    public byte[] Version { get; set; } = [];
}
public sealed class ScheduleAssignment
{
    public Guid Id { get; set; }
    public Guid WeekId { get; set; }
    public Guid StaffId { get; set; }
    public Guid CoverageId { get; set; }
    public DateOnly Date { get; set; }
    public string Shift { get; set; } = "morning";
    public bool Cancelled { get; set; }
    public string Reason { get; set; } = "";
    public string? TransferConsent { get; set; }
    public bool PatientConfirmed { get; set; }
    public string? PatientEvidence { get; set; }
    public Guid? ConfirmedBy { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTimeOffset? ActualEndAt { get; set; }
    public Guid? EndRecordedBy { get; set; }
    public DateTime? EndRecordedAt { get; set; }
    public string? EndNote { get; set; }
}
public sealed class ScheduleChange
{
    public Guid Id { get; set; }
    public Guid WeekId { get; set; }
    public Guid ActorId { get; set; }
    public DateTime At { get; set; }
    public string Detail { get; set; } = "";
}
