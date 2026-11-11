using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class ProcedureServiceCatalogService(
    AppDbContext db,
    IUnitOfWork unitOfWork,
    IAuditLogHelper auditHelper) : IProcedureServiceCatalogService
{
    private static string NormalizeServiceStatus(string? status)
        => string.IsNullOrWhiteSpace(status) ? "active" : status.Trim().ToLowerInvariant();

    private static string NormalizeSlipStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return "pending";
        var s = status.Trim().ToLowerInvariant();
        return s switch
        {
            "approved" => "verified",
            "hr_approved" => "hr_checked",
            _ => s
        };
    }

    public async Task<ProcedureServiceListItemDto[]> ListAsync(ProcedureServiceListFilter filter, CancellationToken ct)
    {
        var query = db.ProcedureServices.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var status = PayrollParameterRules.NormalizeStatus(filter.Status);
            if (status == "active")
            {
                query = query.Where(s => s.Status == "active" || s.Status == null);
            }
            else
            {
                query = query.Where(s => s.Status == status);
            }
        }

        if (!string.IsNullOrWhiteSpace(filter.Category))
        {
            var cat = filter.Category.Trim();
            query = query.Where(s => s.Category == cat);
        }

        if (!string.IsNullOrWhiteSpace(filter.Q))
        {
            var q = filter.Q.Trim();
            query = query.Where(s =>
                s.ServiceCode.Contains(q) ||
                s.ServiceName.Contains(q) ||
                (s.Category != null && s.Category.Contains(q)));
        }

        var services = await query
            .OrderBy(s => s.ServiceCode)
            .ToListAsync(ct);

        if (services.Count == 0)
        {
            return [];
        }

        var serviceIds = services.Select(s => s.ServiceId).ToList();

        var slipCounts = await db.ProcedureSlips.AsNoTracking()
            .Where(x => serviceIds.Contains(x.ServiceId))
            .GroupBy(x => x.ServiceId)
            .Select(g => new { ServiceId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ServiceId, x => x.Count, ct);

        var activeRuleCounts = await db.CommissionRules.AsNoTracking()
            .Where(r => r.ServiceId != null && serviceIds.Contains(r.ServiceId.Value) && (r.Status == "active" || r.Status == null))
            .GroupBy(r => r.ServiceId!.Value)
            .Select(g => new { ServiceId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ServiceId, x => x.Count, ct);

        return services
            .Select(s => new ProcedureServiceListItemDto(
                s.ServiceId,
                s.ServiceCode,
                s.ServiceName,
                s.Category,
                s.BasePrice,
                NormalizeServiceStatus(s.Status),
                slipCounts.GetValueOrDefault(s.ServiceId, 0),
                activeRuleCounts.GetValueOrDefault(s.ServiceId, 0)))
            .ToArray();
    }

    public async Task<string[]> ListCategoriesAsync(CancellationToken ct)
    {
        var categories = await db.ProcedureServices.AsNoTracking()
            .Where(s => s.Category != null && s.Category != "")
            .Select(s => s.Category!)
            .Distinct()
            .OrderBy(c => c)
            .ToArrayAsync(ct);

        return categories;
    }

    public async Task<ProcedureServiceDetailDto> GetDetailAsync(Guid id, CancellationToken ct)
    {
        var service = await db.ProcedureServices.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ServiceId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy danh mục thủ thuật.");

        var slipsQuery =
            from slip in db.ProcedureSlips.AsNoTracking()
            where slip.ServiceId == id
            join dept in db.Departments.AsNoTracking() on slip.DepartmentId equals dept.DepartmentId into deptJoin
            from dept in deptJoin.DefaultIfEmpty()
            orderby slip.ProcedureDate descending, slip.CreatedAt descending
            select new
            {
                slip.SlipId,
                slip.SlipNumber,
                slip.ProcedureDate,
                slip.PatientCode,
                DepartmentName = dept != null ? dept.Name : null,
                ChargedAmount = slip.ChargedAmount ?? 0m,
                DirectCost = slip.DirectCost ?? 0m,
                slip.IsAfterHours,
                slip.Status
            };

        var allSlips = await slipsQuery.ToListAsync(ct);
        var slipIds = allSlips.Select(x => x.SlipId).ToList();

        var commissionBySlip = slipIds.Count == 0
            ? new Dictionary<Guid, decimal>()
            : await db.ProcedureAssignments.AsNoTracking()
                .Where(a => slipIds.Contains(a.SlipId))
                .GroupBy(a => a.SlipId)
                .Select(g => new
                {
                    SlipId = g.Key,
                    TotalCommission = g.Sum(x => x.CommissionAmount ?? 0m)
                })
                .ToDictionaryAsync(x => x.SlipId, x => x.TotalCommission, ct);

        int pendingSlips = 0, hrCheckedSlips = 0, verifiedSlips = 0, rejectedSlips = 0;
        decimal totalChargedAmount = 0m, totalCommissionAmount = 0m;

        foreach (var s in allSlips)
        {
            var st = NormalizeSlipStatus(s.Status);
            switch (st)
            {
                case "pending": pendingSlips++; break;
                case "hr_checked": hrCheckedSlips++; break;
                case "verified": verifiedSlips++; break;
                case "rejected": rejectedSlips++; break;
            }
            totalChargedAmount += s.ChargedAmount;
            totalCommissionAmount += commissionBySlip.GetValueOrDefault(s.SlipId, 0m);
        }

        var recentSlips = allSlips
            .Take(20)
            .Select(s => new ProcedureServiceSlipSummaryDto(
                s.SlipId,
                s.SlipNumber,
                s.ProcedureDate,
                s.PatientCode,
                s.DepartmentName,
                s.ChargedAmount,
                s.DirectCost,
                s.IsAfterHours,
                commissionBySlip.GetValueOrDefault(s.SlipId, 0m),
                NormalizeSlipStatus(s.Status)))
            .ToList();

        var category = service.Category;
        var rules = await (
            from r in db.CommissionRules.AsNoTracking()
            where r.ServiceId == id || (r.ServiceId == null && category != null && r.ServiceCategory == category)
            join p in db.Positions.AsNoTracking() on r.PositionId equals p.PositionId into posJoin
            from p in posJoin.DefaultIfEmpty()
            orderby r.ServiceId descending, r.Status, r.Role, r.EffectiveFrom descending
            select new ProcedureServiceRuleSummaryDto(
                r.RuleId,
                r.ServiceId == id,
                p != null ? p.Name : null,
                r.Role,
                r.TimeCondition,
                r.ValueType,
                r.CommissionValue,
                r.EffectiveFrom,
                r.EffectiveTo,
                r.Status ?? "active")
        ).ToListAsync(ct);

        var directRules = rules.Where(r => r.IsDirectRule).ToList();
        var activeDirectRuleCount = directRules.Count(r => r.Status == "active");
        var categoryRuleCount = rules.Count(r => !r.IsDirectRule);

        var overrides = await (
            from o in db.StaffCommissionOverrides.AsNoTracking()
            where o.ServiceId == id || (o.ServiceId == null && category != null && o.ServiceCategory == category)
            join st in db.Staff.AsNoTracking() on o.StaffId equals st.StaffId
            orderby o.ServiceId descending, o.Status, st.StaffCode, o.Role
            select new ProcedureServiceOverrideSummaryDto(
                o.OverrideId,
                o.StaffId,
                st.StaffCode,
                st.FullName,
                o.ServiceId == id,
                o.Role,
                o.TimeCondition,
                o.ValueType,
                o.CommissionValue,
                o.EffectiveFrom,
                o.EffectiveTo,
                o.Status ?? "active")
        ).ToListAsync(ct);

        var rawLogs = await (
            from log in db.AuditLogs.AsNoTracking()
            where log.EntityType == "ProcedureService" && log.EntityId == id
            join u in db.Users.AsNoTracking() on log.UserId equals u.UserId into uJoin
            from u in uJoin.DefaultIfEmpty()
            orderby log.CreatedAt descending
            select new
            {
                log.LogId,
                log.Action,
                log.Username,
                ActorFullName = u != null ? u.FullName : null,
                log.OldValue,
                log.NewValue,
                log.CreatedAt
            }
        ).Take(30).ToListAsync(ct);

        var auditHistory = rawLogs
            .Select(l => new ProcedureSlipAuditItemDto(
                l.LogId,
                l.Action,
                l.Username,
                l.ActorFullName ?? l.Username,
                FormatAuditDetail(l.Action, l.OldValue, l.NewValue),
                l.CreatedAt))
            .ToList();

        return new ProcedureServiceDetailDto(
            service.ServiceId,
            service.ServiceCode,
            service.ServiceName,
            service.Category,
            service.BasePrice,
            NormalizeServiceStatus(service.Status),
            allSlips.Count,
            pendingSlips,
            hrCheckedSlips,
            verifiedSlips,
            rejectedSlips,
            totalChargedAmount,
            totalCommissionAmount,
            directRules.Count,
            activeDirectRuleCount,
            categoryRuleCount,
            overrides.Count,
            recentSlips,
            rules,
            overrides,
            auditHistory);
    }

    public async Task<ProcedureServiceListItemDto> CreateAsync(CreateProcedureServiceRequest request, CancellationToken ct)
    {
        var code = PayrollParameterRules.NormalizeCode(request.Code, 30);
        var name = PayrollParameterRules.RequireText(request.Name, "Tên thủ thuật", 200);
        var category = string.IsNullOrWhiteSpace(request.Category)
            ? null
            : PayrollParameterRules.RequireText(request.Category, "Nhóm dịch vụ / chuyên khoa", 100);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        if (request.BasePrice.HasValue)
        {
            PayrollParameterRules.EnsureMoney(request.BasePrice.Value, "Đơn giá niêm yết");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        if (await db.ProcedureServices.AnyAsync(s => s.ServiceCode == code, ct))
        {
            throw new AppException(409, $"Mã thủ thuật '{code}' đã tồn tại.", "code");
        }

        var entity = new ProcedureService
        {
            ServiceId = Guid.NewGuid(),
            ServiceCode = code,
            ServiceName = name,
            Category = category,
            BasePrice = request.BasePrice,
            Status = status
        };

        db.ProcedureServices.Add(entity);

        auditHelper.Log("create", "ProcedureService", entity.ServiceId, null, new
        {
            entity.ServiceCode,
            entity.ServiceName,
            entity.Category,
            entity.BasePrice,
            entity.Status
        });

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new ProcedureServiceListItemDto(
            entity.ServiceId,
            entity.ServiceCode,
            entity.ServiceName,
            entity.Category,
            entity.BasePrice,
            NormalizeServiceStatus(entity.Status),
            0,
            0);
    }

    public async Task<ProcedureServiceListItemDto> UpdateAsync(Guid id, UpdateProcedureServiceRequest request, CancellationToken ct)
    {
        var code = PayrollParameterRules.NormalizeCode(request.Code, 30);
        var name = PayrollParameterRules.RequireText(request.Name, "Tên thủ thuật", 200);
        var category = string.IsNullOrWhiteSpace(request.Category)
            ? null
            : PayrollParameterRules.RequireText(request.Category, "Nhóm dịch vụ / chuyên khoa", 100);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        if (request.BasePrice.HasValue)
        {
            PayrollParameterRules.EnsureMoney(request.BasePrice.Value, "Đơn giá niêm yết");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await db.ProcedureServices.FirstOrDefaultAsync(s => s.ServiceId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy danh mục thủ thuật.");

        var slipCount = await db.ProcedureSlips.CountAsync(s => s.ServiceId == id, ct);
        if (!string.Equals(entity.ServiceCode, code, StringComparison.OrdinalIgnoreCase) && slipCount > 0)
        {
            throw new AppException(409, "Không thể đổi mã thủ thuật đã phát sinh phiếu thủ thuật.", "code");
        }

        if (await db.ProcedureServices.AnyAsync(s => s.ServiceId != id && s.ServiceCode == code, ct))
        {
            throw new AppException(409, $"Mã thủ thuật '{code}' đã tồn tại.", "code");
        }

        var oldSnapshot = new
        {
            entity.ServiceCode,
            entity.ServiceName,
            entity.Category,
            entity.BasePrice,
            Status = NormalizeServiceStatus(entity.Status)
        };

        entity.ServiceCode = code;
        entity.ServiceName = name;
        entity.Category = category;
        entity.BasePrice = request.BasePrice;
        entity.Status = status;

        var newSnapshot = new
        {
            entity.ServiceCode,
            entity.ServiceName,
            entity.Category,
            entity.BasePrice,
            entity.Status
        };

        auditHelper.Log("update", "ProcedureService", entity.ServiceId, oldSnapshot, newSnapshot);

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var activeRuleCount = await db.CommissionRules.AsNoTracking()
            .CountAsync(r => r.ServiceId == id && (r.Status == "active" || r.Status == null), ct);

        return new ProcedureServiceListItemDto(
            entity.ServiceId,
            entity.ServiceCode,
            entity.ServiceName,
            entity.Category,
            entity.BasePrice,
            NormalizeServiceStatus(entity.Status),
            slipCount,
            activeRuleCount);
    }

    public async Task<ProcedureServiceListItemDto> SetStatusAsync(Guid id, string status, CancellationToken ct)
    {
        var normalizedStatus = PayrollParameterRules.NormalizeStatus(status);

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await db.ProcedureServices.FirstOrDefaultAsync(s => s.ServiceId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy danh mục thủ thuật.");

        var oldStatus = NormalizeServiceStatus(entity.Status);
        if (oldStatus != normalizedStatus)
        {
            entity.Status = normalizedStatus;
            auditHelper.Log(
                normalizedStatus == "inactive" ? "deactivate" : "activate",
                "ProcedureService",
                entity.ServiceId,
                new { Status = oldStatus },
                new { Status = normalizedStatus });

            await unitOfWork.SaveChangesAsync(ct);
        }

        await tx.CommitAsync(ct);

        var slipCount = await db.ProcedureSlips.AsNoTracking().CountAsync(s => s.ServiceId == id, ct);
        var activeRuleCount = await db.CommissionRules.AsNoTracking()
            .CountAsync(r => r.ServiceId == id && (r.Status == "active" || r.Status == null), ct);

        return new ProcedureServiceListItemDto(
            entity.ServiceId,
            entity.ServiceCode,
            entity.ServiceName,
            entity.Category,
            entity.BasePrice,
            NormalizeServiceStatus(entity.Status),
            slipCount,
            activeRuleCount);
    }

    private static string? FormatAuditDetail(string action, string? oldJson, string? newJson)
    {
        try
        {
            return action switch
            {
                "create" => "Tạo mới danh mục thủ thuật",
                "deactivate" => "Vô hiệu hóa (ngừng sử dụng) thủ thuật",
                "activate" => "Kích hoạt lại thủ thuật",
                "update" => FormatUpdateDetail(oldJson, newJson),
                _ => null
            };
        }
        catch
        {
            return null;
        }
    }

    private static string FormatUpdateDetail(string? oldJson, string? newJson)
    {
        if (string.IsNullOrWhiteSpace(newJson)) return "Cập nhật thông tin thủ thuật";
        using var doc = JsonDocument.Parse(newJson);
        var root = doc.RootElement;
        var name = root.TryGetProperty("serviceName", out var n) ? n.GetString() : null;
        var price = root.TryGetProperty("basePrice", out var p) && p.ValueKind == JsonValueKind.Number
            ? $"{p.GetDecimal():N0} đ"
            : "Chưa đặt giá";
        return name is not null
            ? $"Cập nhật '{name}' (Đơn giá: {price})"
            : "Cập nhật thông tin thủ thuật";
    }
}
