using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Security;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize(Policy = "Admin"), Route("api/roles")]
public sealed class RolesController(AppDbContext db, IUserService users) : ControllerBase
{
    public sealed record Definition(string Id, string Name, string Description, string[] Areas);
    public static readonly Definition[] Catalog = [
        new(AccountRoles.Administrator, "Administrator", "Quản trị tài khoản, phân vai trò và kiểm tra nhật ký hệ thống.", ["Tài khoản", "Vai trò", "Nhật ký hệ thống", "Xem lịch/chấm công và đợt nhập", "Theo dõi tuân thủ"]),
        new(AccountRoles.HrManager, "HR Manager", "Quản lý hồ sơ, tổ chức, hợp đồng và theo dõi tuân thủ.", ["Nhân viên", "Khoa/phòng", "Hợp đồng", "Chứng chỉ và CME", "Xem lịch/chấm công, đợt nhập và lịch sử"]),
        new(AccountRoles.HrStaff, "HR Staff", "Lập lịch, nhập và đối chiếu dữ liệu chấm công, ghi nhận trực.", ["Lịch làm việc", "Nhập chấm công", "Hồ sơ trực", "Lịch sử chấm công"]),
        new(AccountRoles.Accountant, "Accountant", "Quản lý tham số, kỳ lương và kiểm tra lịch sử phục vụ đối soát.", ["Tham số lương", "Kỳ tính lương", "Thủ thuật", "Lịch sử chấm công"]),
        new(AccountRoles.DepartmentManager, "Department Manager", "Theo dõi nhân sự và dữ liệu thuộc khoa/phòng được giao.", ["Chấm công trong khoa/phòng", "Thủ thuật", "Theo dõi tuân thủ"]),
        new(AccountRoles.MedicalStaff, "Medical Staff", "Xem lịch và chấm công cá nhân, quản lý thông tin tự phục vụ.", ["Lịch cá nhân", "Chấm công cá nhân", "Hồ sơ cá nhân", "Đơn nghỉ phép"])
    ];

    [HttpGet]
    public async Task<object> List(CancellationToken ct)
    {
        var counts = await db.Users.AsNoTracking().Where(x => x.IsProvisioned).GroupBy(x => x.Role)
            .Select(g => new { role = g.Key, count = g.Count() }).ToDictionaryAsync(x => x.role, x => x.count, ct);
        return Catalog.Select(role => new { role.Id, role.Name, role.Description, role.Areas, accountCount = counts.GetValueOrDefault(role.Id) });
    }
    [HttpGet("{role}")]
    public async Task<object> Detail(string role, CancellationToken ct)
    {
        var definition = Catalog.SingleOrDefault(x => x.Id == role) ?? throw new AppException(404, "Không có vai trò này.");
        return new { role = definition, accounts = (await users.ListAsync(ct)).Where(x => x.Role == role).ToArray() };
    }
}
