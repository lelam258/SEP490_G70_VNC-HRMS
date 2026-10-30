using Microsoft.AspNetCore.Http;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.SelfService;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class SelfServiceProfileService(
    ISelfServiceRepository repository,
    IUnitOfWork unitOfWork,
    IFileService fileService,
    IAuditLogHelper auditHelper) : ISelfServiceProfileService
{
    private const string NotFoundStaffMessage = "Tài khoản chưa liên kết hồ sơ nhân viên. Vui lòng liên hệ bộ phận nhân sự.";

    public async Task<UserProfileDto> GetProfileAsync(Guid userId, CancellationToken ct)
    {
        var profile = await repository.GetProfileByUserIdAsync(userId, ct);
        if (profile is null)
        {
            throw new AppException(404, NotFoundStaffMessage);
        }
        return profile;
    }

    public async Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct)
    {
        var staff = await repository.FindStaffByUserIdAsync(userId, ct)
            ?? throw new AppException(404, NotFoundStaffMessage);

        var user = await repository.FindUserByIdAsync(userId, ct);

        var fullName = ProfileRules.ValidateAndNormalizeFullName(request.FullName);
        var dateOfBirth = ProfileRules.ValidateDateOfBirth(request.DateOfBirth);
        var gender = ProfileRules.ValidateAndNormalizeGender(request.Gender);
        var idCardNumberToken = ProfileRules.ValidateAndNormalizeIdCardNumber(request.IdCardNumber);
        var phone = ProfileRules.NormalizePhone(request.Phone);

        string? newIdCardNumber = staff.IdCardNumber;
        if (idCardNumberToken == "CLEAR")
        {
            newIdCardNumber = null;
        }
        else if (idCardNumberToken is not null)
        {
            var isDuplicate = await repository.IsIdCardInUseAsync(idCardNumberToken, staff.StaffId, ct);
            if (isDuplicate)
            {
                throw new AppException(409, "Số CCCD đã được sử dụng.", "idCardNumber");
            }
            newIdCardNumber = idCardNumberToken;
        }

        var oldValues = new Dictionary<string, object?>();
        var newValues = new Dictionary<string, object?>();

        if (staff.FullName != fullName)
        {
            oldValues["FullName"] = staff.FullName;
            newValues["FullName"] = fullName;
        }
        if (staff.DateOfBirth != dateOfBirth)
        {
            oldValues["DateOfBirth"] = staff.DateOfBirth;
            newValues["DateOfBirth"] = dateOfBirth;
        }
        if (staff.Gender != gender)
        {
            oldValues["Gender"] = staff.Gender;
            newValues["Gender"] = gender;
        }
        if (staff.IdCardNumber != newIdCardNumber)
        {
            oldValues["IdCardNumber"] = ProfileRules.MaskIdCard(staff.IdCardNumber);
            newValues["IdCardNumber"] = ProfileRules.MaskIdCard(newIdCardNumber);
        }
        if (staff.Phone != phone)
        {
            oldValues["Phone"] = staff.Phone;
            newValues["Phone"] = phone;
        }

        if (oldValues.Count > 0)
        {
            await using var tx = await unitOfWork.BeginTransactionAsync(ct);

            staff.FullName = fullName;
            staff.DateOfBirth = dateOfBirth;
            staff.Gender = gender;
            staff.IdCardNumber = newIdCardNumber;
            staff.Phone = phone;
            staff.UpdatedAt = DateTime.UtcNow;

            if (user is not null && user.FullName != fullName)
            {
                user.FullName = fullName;
                user.UpdatedAt = DateTime.UtcNow;
            }

            auditHelper.Log("update", "Staff", staff.StaffId, oldValues, newValues);

            await unitOfWork.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }

        return await GetProfileAsync(userId, ct);
    }

    public async Task<UserProfileDto> UploadAvatarAsync(Guid userId, IFormFile file, CancellationToken ct)
    {
        var staff = await repository.FindStaffByUserIdAsync(userId, ct)
            ?? throw new AppException(404, NotFoundStaffMessage);

        if (file == null || file.Length == 0)
        {
            throw new AppException(400, "Vui lòng chọn ảnh đại diện.");
        }

        if (file.Length > 2 * 1024 * 1024)
        {
            throw new AppException(400, "Ảnh đại diện tối đa 2 MB.");
        }

        await using var stream = file.OpenReadStream();
        var uploadResult = await fileService.UploadAsync(stream, file.FileName, file.ContentType, file.Length, ct);

        var oldSnapshot = new { staff.AvatarUrl };
        staff.AvatarUrl = uploadResult.Url;
        staff.UpdatedAt = DateTime.UtcNow;
        var newSnapshot = new { AvatarUrl = uploadResult.Url };

        auditHelper.Log("update", "Staff", staff.StaffId, oldSnapshot, newSnapshot);

        await unitOfWork.SaveChangesAsync(ct);

        return await GetProfileAsync(userId, ct);
    }
}
