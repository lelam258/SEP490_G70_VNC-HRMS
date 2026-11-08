-- User-supplied CS1 roster. Run with sqlcmd -f 65001 -b against the intended database.
-- No login is provisioned. DateJoined is an IMPORT PLACEHOLDER (2026-11-01), not verified employment history.
-- Existing matching names are skipped. Re-running does not overwrite existing records.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRANSACTION;

DECLARE @SiteId uniqueidentifier = (SELECT site_id FROM dbo.sites WHERE site_code = N'CS1');
IF @SiteId IS NULL THROW 50001, N'Không tìm thấy cơ sở CS1.', 1;

DECLARE @Roster TABLE (Ordinal int PRIMARY KEY, FullName nvarchar(100), DepartmentName nvarchar(100), PositionName nvarchar(100), Duties nvarchar(200));
INSERT @Roster VALUES
(1,N'Nguyễn Mạnh Tuyến',N'Ban Giám đốc',N'Giám đốc',N'Giám đốc'),
(2,N'Trần Thị Chính',N'Hành chính - Kế toán',N'Quản lý nhân sự',N'Quản lý nhân sự; Kế toán trưởng; Chủ đầu tư'),
(3,N'Lê Ngọc Mai',N'Khoa Bác sĩ',N'Phó Giám đốc',N'Phó Giám đốc; Bác sĩ'),
(4,N'Nguyễn Văn Thịnh',N'Khoa Bác sĩ',N'Bác sĩ',N'Bác sĩ'),
(5,N'Đỗ Tấn Phú',N'Khoa Bác sĩ',N'Bác sĩ',N'Bác sĩ'),
(6,N'Trương Đình Hoàng',N'Khoa Kỹ thuật viên',N'Kỹ thuật viên',N'Kỹ thuật viên chẩn đoán hình ảnh'),
(7,N'Lý Văn Đoàn',N'Khoa Kỹ thuật viên',N'Y sĩ',N'Y sĩ; Kỹ thuật viên nội soi tai mũi họng, tiêu hóa'),
(8,N'Đinh Hà Nam',N'Khoa Kỹ thuật viên',N'Kỹ thuật viên',N'Kỹ thuật viên chẩn đoán hình ảnh'),
(9,N'Vũ Thị Thủy',N'Khoa Điều Dưỡng',N'Điều dưỡng trưởng',N'Điều dưỡng trưởng'),
(10,N'Phan Thị Ngát',N'Khoa Điều Dưỡng',N'Điều dưỡng',N'Điều dưỡng; Chủ tịch Công đoàn'),
(11,N'Đỗ Thị Hương Liên',N'Khoa Điều Dưỡng',N'Điều dưỡng',N'Điều dưỡng'),
(12,N'Nguyễn Phương Thảo',N'Khoa Điều Dưỡng',N'Điều dưỡng',N'Điều dưỡng'),
(13,N'Nguyễn Thị Hằng',N'Khoa Điều Dưỡng',N'Điều dưỡng',N'Điều dưỡng'),
(14,N'Nguyễn Thị Hải',N'Khoa Xét nghiệm',N'Trưởng phòng Xét nghiệm',N'Kỹ thuật viên xét nghiệm; Trưởng phòng Xét nghiệm'),
(15,N'Nguyễn Hà Chi',N'Khoa Xét nghiệm',N'Kỹ thuật viên',N'Kỹ thuật viên xét nghiệm'),
(16,N'Lê Thu Trang',N'Khoa Xét nghiệm',N'Kỹ thuật viên',N'Kỹ thuật viên xét nghiệm'),
(17,N'Nguyễn Thị Mai',N'Khoa Xét nghiệm',N'Kỹ thuật viên',N'Kỹ thuật viên xét nghiệm'),
(18,N'Vũ Thị Thu',N'Bộ phận Dược',N'Dược sĩ',N'Dược sĩ'),
(19,N'Phạm Thị Thu Trang',N'Bộ phận Dược',N'Dược sĩ',N'Dược sĩ'),
(20,N'Đỗ Ngọc Mai',N'Hành chính - Kế toán',N'Kế toán',N'Kế toán'),
(21,N'Nguyễn Công Minh',N'Khoa Kỹ thuật viên',N'Kỹ thuật viên',N'Kỹ thuật viên; chưa xác định chức năng phòng máy'),
(22,N'Bà Mười',N'Bộ phận Hậu cần',N'Nhân viên vệ sinh',N'Nhân viên vệ sinh; tên gọi theo danh sách, chưa có họ tên đầy đủ'),
(23,N'Trần Hữu Hoàn',N'Khoa Bác sĩ',N'Bác sĩ',N'Bác sĩ làm bán thời gian');

-- Abort rather than guessing if existing names are ambiguous or already belong to another site.
IF EXISTS (SELECT r.FullName FROM @Roster r JOIN dbo.staff s ON LTRIM(RTRIM(s.full_name)) COLLATE Vietnamese_100_CI_AS = r.FullName COLLATE Vietnamese_100_CI_AS GROUP BY r.FullName HAVING COUNT(*) > 1)
    THROW 50002, N'Có nhiều hồ sơ cùng họ tên; cần đối chiếu trước khi nhập.', 1;
IF EXISTS (SELECT 1 FROM @Roster r JOIN dbo.staff s ON LTRIM(RTRIM(s.full_name)) COLLATE Vietnamese_100_CI_AS = r.FullName COLLATE Vietnamese_100_CI_AS WHERE s.site_id IS NOT NULL AND s.site_id <> @SiteId)
    THROW 50003, N'Hồ sơ trùng tên thuộc cơ sở khác; cần đối chiếu trước khi nhập.', 1;

INSERT dbo.departments (department_id, dept_code, name, status)
SELECT NEWID(), N'CS1-D' + RIGHT(N'00' + CAST(MIN(r.Ordinal) AS nvarchar(2)),2), r.DepartmentName, N'active'
FROM @Roster r WHERE NOT EXISTS (SELECT 1 FROM dbo.departments d WHERE d.name = r.DepartmentName)
GROUP BY r.DepartmentName;
INSERT dbo.positions (position_id, name, status)
SELECT NEWID(), r.PositionName, N'active' FROM @Roster r
WHERE NOT EXISTS (SELECT 1 FROM dbo.positions p WHERE p.name = r.PositionName)
GROUP BY r.PositionName;

DECLARE @Added TABLE (StaffCode nvarchar(20), FullName nvarchar(100));
DECLARE @Ordinal int, @Name nvarchar(100), @Dept nvarchar(100), @Position nvarchar(100), @Duties nvarchar(200);
DECLARE roster_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT Ordinal, FullName, DepartmentName, PositionName, Duties FROM @Roster ORDER BY Ordinal;
OPEN roster_cursor;
FETCH NEXT FROM roster_cursor INTO @Ordinal,@Name,@Dept,@Position,@Duties;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.staff WHERE LTRIM(RTRIM(full_name)) COLLATE Vietnamese_100_CI_AS = @Name COLLATE Vietnamese_100_CI_AS)
    BEGIN
        DECLARE @Code nvarchar(20) = N'CS1-' + RIGHT(N'000' + CAST(@Ordinal AS nvarchar(3)),3);
        IF EXISTS (SELECT 1 FROM dbo.staff WHERE staff_code = @Code) THROW 50004, N'Mã nhân viên CS1 đã được sử dụng bởi người khác.', 1;
        DECLARE @UserId uniqueidentifier = NEWID(), @StaffId uniqueidentifier = NEWID();
        DECLARE @Username nvarchar(50) = N'pending_' + REPLACE(CONVERT(nvarchar(36), @UserId),N'-',N'');
        -- Random Identity-v2-shaped salt/subkey: no known password; account inactive and unprovisioned.
        DECLARE @RandomHash varbinary(49) = 0x00 + CRYPT_GEN_RANDOM(48);
        DECLARE @Hash nvarchar(255) = CAST(N'' AS xml).value('xs:base64Binary(sql:variable("@RandomHash"))','nvarchar(255)');
        INSERT dbo.users (user_id,username,normalized_username,full_name,role,account_status,is_provisioned,security_version,password_hash)
        VALUES (@UserId,@Username,UPPER(@Username),@Name,N'employee',N'inactive',0,0,@Hash);
        INSERT dbo.staff (staff_id,user_id,staff_code,full_name,department_id,position_id,scope_of_practice,date_joined,dependent_count,status,site_id)
        VALUES (@StaffId,@UserId,@Code,@Name,(SELECT department_id FROM dbo.departments WHERE name=@Dept),
            (SELECT position_id FROM dbo.positions WHERE name=@Position),@Duties,'2026-11-01',0,N'active',@SiteId);
        INSERT @Added VALUES (@Code,@Name);
    END;
    FETCH NEXT FROM roster_cursor INTO @Ordinal,@Name,@Dept,@Position,@Duties;
END;
CLOSE roster_cursor;
DEALLOCATE roster_cursor;

-- Named leadership only; do not replace an existing department manager or grant login roles.
UPDATE d SET manager_id=s.staff_id, updated_at=SYSUTCDATETIME()
FROM dbo.departments d JOIN dbo.staff s ON s.department_id=d.department_id
WHERE d.manager_id IS NULL AND s.site_id=@SiteId AND
    ((d.name=N'Khoa Điều Dưỡng' AND s.full_name=N'Vũ Thị Thủy') OR
     (d.name=N'Khoa Xét nghiệm' AND s.full_name=N'Nguyễn Thị Hải'));

COMMIT TRANSACTION;
SELECT StaffCode,FullName FROM @Added ORDER BY StaffCode;
SELECT COUNT(*) AS MatchedRosterCount FROM @Roster r JOIN dbo.staff s ON LTRIM(RTRIM(s.full_name)) COLLATE Vietnamese_100_CI_AS = r.FullName COLLATE Vietnamese_100_CI_AS WHERE s.site_id=@SiteId;
