using Vnc.HRMS.Models;

namespace Vnc.HRMS.DTOs.Schedules;

// Stored when a published week is reopened, independently of the editable assignments.
public sealed record ScheduleRosterRow(ScheduleAssignment Assignment, bool Published, string FullName,
    string Facility, Guid FacilityId, string Coverage, Guid DepartmentId);
