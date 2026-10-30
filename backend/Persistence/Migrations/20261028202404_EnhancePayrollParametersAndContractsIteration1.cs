using System;



using Microsoft.EntityFrameworkCore.Migrations;







#nullable disable







namespace Vnc.HRMS.Persistence.Migrations



{



    /// <inheritdoc />



    public partial class EnhancePayrollParametersAndContractsIteration1 : Migration



    {



        /// <inheritdoc />



        protected override void Up(MigrationBuilder migrationBuilder)



        {



            migrationBuilder.DropCheckConstraint(



                name: "CK_contracts_2",



                schema: "dbo",



                table: "contracts");







            migrationBuilder.AddColumn<string>(



                name: "calc_method",



                schema: "dbo",



                table: "staff_allowances",



                type: "nvarchar(30)",



                nullable: true,



                defaultValueSql: "'fixed'");







            migrationBuilder.AddColumn<bool>(



                name: "is_union_member",



                schema: "dbo",



                table: "staff",



                type: "bit",



                nullable: false,



                defaultValue: true);







            migrationBuilder.AddColumn<Guid>(



                name: "site_id",



                schema: "dbo",



                table: "staff",



                type: "uniqueidentifier",



                nullable: true);







            migrationBuilder.AddColumn<decimal>(



                name: "charged_amount",



                schema: "dbo",



                table: "procedure_slips",



                type: "decimal(15,2)",



                nullable: true);







            migrationBuilder.AddColumn<decimal>(



                name: "direct_cost",



                schema: "dbo",



                table: "procedure_slips",



                type: "decimal(15,2)",



                nullable: true);







            migrationBuilder.AddColumn<decimal>(



                name: "duration_hours",



                schema: "dbo",



                table: "procedure_slips",



                type: "decimal(4,2)",



                nullable: true);







            migrationBuilder.AddColumn<Guid>(



                name: "indicating_staff_id",



                schema: "dbo",



                table: "procedure_slips",



                type: "uniqueidentifier",



                nullable: true);







            migrationBuilder.AddColumn<bool>(



                name: "is_after_hours",



                schema: "dbo",



                table: "procedure_slips",



                type: "bit",



                nullable: false,



                defaultValue: false);







            migrationBuilder.AddColumn<decimal>(



                name: "base_price",



                schema: "dbo",



                table: "procedure_services",



                type: "decimal(15,2)",



                nullable: true);







            migrationBuilder.AddColumn<decimal>(



                name: "monthly_salary",



                schema: "dbo",



                table: "contracts",



                type: "decimal(15,2)",



                precision: 15,



                scale: 2,



                nullable: true);







            migrationBuilder.AddColumn<string>(



                name: "salary_type",



                schema: "dbo",



                table: "contracts",



                type: "nvarchar(20)",



                maxLength: 20,



                nullable: false,



                defaultValue: "daily");







            migrationBuilder.AddColumn<decimal>(



                name: "standard_working_days",



                schema: "dbo",



                table: "contracts",



                type: "decimal(5,2)",



                precision: 5,



                scale: 2,



                nullable: true);







            migrationBuilder.AddColumn<string>(



                name: "tax_method",



                schema: "dbo",



                table: "contracts",



                type: "nvarchar(20)",



                maxLength: 20,



                nullable: false,



                defaultValue: "progressive");







            migrationBuilder.AlterColumn<Guid>(



                name: "service_id",



                schema: "dbo",



                table: "commission_rules",



                type: "uniqueidentifier",



                nullable: true,



                oldClrType: typeof(Guid),



                oldType: "uniqueidentifier");







            migrationBuilder.AddColumn<Guid>(



                name: "position_id",



                schema: "dbo",



                table: "commission_rules",



                type: "uniqueidentifier",



                nullable: true);







            migrationBuilder.AddColumn<string>(



                name: "service_category",



                schema: "dbo",



                table: "commission_rules",



                type: "nvarchar(100)",



                nullable: true);







            migrationBuilder.AddColumn<string>(



                name: "time_condition",



                schema: "dbo",



                table: "commission_rules",



                type: "nvarchar(20)",



                nullable: false,



                defaultValueSql: "'all'");







            migrationBuilder.AddColumn<string>(



                name: "default_calc_method",



                schema: "dbo",



                table: "allowance_types",



                type: "nvarchar(30)",



                nullable: false,



                defaultValueSql: "'fixed'");







            migrationBuilder.AddColumn<int>(



                name: "min_service_years",



                schema: "dbo",



                table: "allowance_types",



                type: "int",



                nullable: true);







            migrationBuilder.CreateTable(



                name: "contract_salary_histories",



                schema: "dbo",



                columns: table => new



                {



                    history_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),



                    contract_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),



                    salary_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),



                    daily_rate = table.Column<decimal>(type: "decimal(15,2)", precision: 15, scale: 2, nullable: false),



                    monthly_salary = table.Column<decimal>(type: "decimal(15,2)", precision: 15, scale: 2, nullable: true),



                    insurance_salary_basis = table.Column<decimal>(type: "decimal(15,2)", precision: 15, scale: 2, nullable: true),



                    standard_working_days = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),



                    tax_method = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),



                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),



                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),



                    note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),



                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),



                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")



                },



                constraints: table =>



                {



                    table.PrimaryKey("PK_contract_salary_histories", x => x.history_id);



                    table.CheckConstraint("CK_contract_salary_histories_1", "[effective_to] IS NULL OR [effective_to] >= [effective_from]");



                    table.ForeignKey(



                        name: "FK_contract_salary_histories_contracts_contract_id",



                        column: x => x.contract_id,



                        principalSchema: "dbo",



                        principalTable: "contracts",



                        principalColumn: "contract_id",



                        onDelete: ReferentialAction.Restrict);



                });







            migrationBuilder.Sql(@"

IF OBJECT_ID('dbo.leave_types', 'U') IS NULL

BEGIN

    CREATE TABLE [dbo].[leave_types] (

        [leave_type_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),

        [code] nvarchar(50) NOT NULL,

        [name] nvarchar(100) NOT NULL,

        [description] nvarchar(255) NULL,

        [is_paid] bit NOT NULL DEFAULT CAST(1 AS bit),

        [status] nvarchar(20) NOT NULL DEFAULT ('active'),

        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),

        [updated_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT [PK_leave_types] PRIMARY KEY ([leave_type_id])

    );

END");







            migrationBuilder.CreateTable(



                name: "payroll_rate_configs",



                schema: "dbo",



                columns: table => new



                {



                    config_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),



                    code = table.Column<string>(type: "nvarchar(50)", nullable: false),



                    position_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),



                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),



                    rate_value = table.Column<decimal>(type: "decimal(15,4)", nullable: false),



                    unit = table.Column<string>(type: "nvarchar(20)", nullable: false),



                    description = table.Column<string>(type: "nvarchar(255)", nullable: true),



                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),



                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),



                    status = table.Column<string>(type: "nvarchar(20)", nullable: false, defaultValueSql: "'active'"),



                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),



                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")



                },



                constraints: table =>



                {



                    table.PrimaryKey("PK_payroll_rate_configs", x => x.config_id);



                    table.CheckConstraint("CK_payroll_rate_configs_1", "[effective_to] IS NULL OR [effective_to] >= [effective_from]");



                    table.CheckConstraint("CK_payroll_rate_configs_2", "[rate_value] >= 0");



                    table.ForeignKey(



                        name: "FK_payroll_rate_configs_positions_position_id",



                        column: x => x.position_id,



                        principalSchema: "dbo",



                        principalTable: "positions",



                        principalColumn: "position_id",



                        onDelete: ReferentialAction.Restrict);



                    table.ForeignKey(



                        name: "FK_payroll_rate_configs_staff_staff_id",



                        column: x => x.staff_id,



                        principalSchema: "dbo",



                        principalTable: "staff",



                        principalColumn: "staff_id",



                        onDelete: ReferentialAction.Restrict);



                });







            migrationBuilder.CreateTable(



                name: "sites",



                schema: "dbo",



                columns: table => new



                {



                    site_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),



                    site_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),



                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),



                    address = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),



                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active")



                },



                constraints: table =>



                {



                    table.PrimaryKey("PK_sites", x => x.site_id);



                });







            migrationBuilder.CreateTable(



                name: "staff_commission_overrides",



                schema: "dbo",



                columns: table => new



                {



                    override_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),



                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),



                    service_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),



                    service_category = table.Column<string>(type: "nvarchar(100)", nullable: true),



                    role = table.Column<string>(type: "nvarchar(50)", nullable: false),



                    value_type = table.Column<string>(type: "nvarchar(20)", nullable: false),



                    time_condition = table.Column<string>(type: "nvarchar(20)", nullable: false, defaultValueSql: "'all'"),



                    commission_value = table.Column<decimal>(type: "decimal(15,4)", nullable: false),



                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),



                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),



                    status = table.Column<string>(type: "nvarchar(20)", nullable: false, defaultValueSql: "'active'"),



                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),



                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")



                },



                constraints: table =>



                {



                    table.PrimaryKey("PK_staff_commission_overrides", x => x.override_id);



                    table.CheckConstraint("CK_staff_commission_overrides_1", "[effective_to] IS NULL OR [effective_to] >= [effective_from]");



                    table.CheckConstraint("CK_staff_commission_overrides_2", "[commission_value] >= 0");



                    table.CheckConstraint("CK_staff_commission_overrides_3", "[service_id] IS NOT NULL OR [service_category] IS NOT NULL");



                    table.ForeignKey(



                        name: "FK_staff_commission_overrides_procedure_services_service_id",



                        column: x => x.service_id,



                        principalSchema: "dbo",



                        principalTable: "procedure_services",



                        principalColumn: "service_id",



                        onDelete: ReferentialAction.Restrict);



                    table.ForeignKey(



                        name: "FK_staff_commission_overrides_staff_staff_id",



                        column: x => x.staff_id,



                        principalSchema: "dbo",



                        principalTable: "staff",



                        principalColumn: "staff_id",



                        onDelete: ReferentialAction.Restrict);



                });







            migrationBuilder.CreateIndex(



                name: "IX_staff_site_id",



                schema: "dbo",



                table: "staff",



                column: "site_id");







            migrationBuilder.CreateIndex(



                name: "IX_procedure_slips_indicating_staff_id",



                schema: "dbo",



                table: "procedure_slips",



                column: "indicating_staff_id");







            migrationBuilder.AddCheckConstraint(



                name: "CK_contracts_2",



                schema: "dbo",



                table: "contracts",



                sql: "[daily_rate] >= 0 AND ([monthly_salary] IS NULL OR [monthly_salary] >= 0) AND ([insurance_salary_basis] IS NULL OR [insurance_salary_basis] >= 0)");







            migrationBuilder.CreateIndex(



                name: "IX_commission_rules_position_id",



                schema: "dbo",



                table: "commission_rules",



                column: "position_id");







            migrationBuilder.AddCheckConstraint(



                name: "CK_commission_rules_3",



                schema: "dbo",



                table: "commission_rules",



                sql: "[service_id] IS NOT NULL OR [service_category] IS NOT NULL");







            migrationBuilder.CreateIndex(



                name: "IX_contract_salary_histories_contract_id_effective_from",



                schema: "dbo",



                table: "contract_salary_histories",



                columns: new[] { "contract_id", "effective_from" });







            migrationBuilder.Sql(@"

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_leave_types_code')

BEGIN

    CREATE UNIQUE INDEX [IX_leave_types_code] ON [dbo].[leave_types] ([code]);

END");







            migrationBuilder.CreateIndex(



                name: "IX_payroll_rate_configs_position_id",



                schema: "dbo",



                table: "payroll_rate_configs",



                column: "position_id");







            migrationBuilder.CreateIndex(



                name: "IX_payroll_rate_configs_staff_id",



                schema: "dbo",



                table: "payroll_rate_configs",



                column: "staff_id");







            migrationBuilder.CreateIndex(



                name: "IX_sites_site_code",



                schema: "dbo",



                table: "sites",



                column: "site_code",



                unique: true);







            migrationBuilder.CreateIndex(



                name: "IX_staff_commission_overrides_service_id",



                schema: "dbo",



                table: "staff_commission_overrides",



                column: "service_id");







            migrationBuilder.CreateIndex(



                name: "IX_staff_commission_overrides_staff_id",



                schema: "dbo",



                table: "staff_commission_overrides",



                column: "staff_id");







            migrationBuilder.AddForeignKey(



                name: "FK_commission_rules_positions_position_id",



                schema: "dbo",



                table: "commission_rules",



                column: "position_id",



                principalSchema: "dbo",



                principalTable: "positions",



                principalColumn: "position_id",



                onDelete: ReferentialAction.Restrict);







            migrationBuilder.AddForeignKey(



                name: "FK_procedure_slips_staff_indicating_staff_id",



                schema: "dbo",



                table: "procedure_slips",



                column: "indicating_staff_id",



                principalSchema: "dbo",



                principalTable: "staff",



                principalColumn: "staff_id",



                onDelete: ReferentialAction.Restrict);







            migrationBuilder.AddForeignKey(



                name: "FK_staff_sites_site_id",



                schema: "dbo",



                table: "staff",



                column: "site_id",



                principalSchema: "dbo",



                principalTable: "sites",



                principalColumn: "site_id",



                onDelete: ReferentialAction.Restrict);







            migrationBuilder.Sql(@"



-- 1. Sites



IF NOT EXISTS (SELECT 1 FROM dbo.sites WHERE site_code = 'CS1')



BEGIN



    INSERT INTO dbo.sites (site_id, site_code, name, address, status)



    VALUES (NEWID(), 'CS1', N'Cơ sở 1 - Phòng khám Đa khoa Việt Nhật', N'Cơ sở chính', 'active');



END







IF NOT EXISTS (SELECT 1 FROM dbo.sites WHERE site_code = 'CS2')



BEGIN



    INSERT INTO dbo.sites (site_id, site_code, name, address, status)



    VALUES (NEWID(), 'CS2', N'Cơ sở 2', N'Cơ sở 2', 'active');



END







-- 2. Backfill staff site_id and is_union_member



DECLARE @cs1Id uniqueidentifier;



SELECT @cs1Id = site_id FROM dbo.sites WHERE site_code = 'CS1';







UPDATE dbo.staff



SET site_id = @cs1Id



WHERE site_id IS NULL;







UPDATE dbo.staff



SET is_union_member = 1



WHERE is_union_member IS NULL;







-- 3. Backfill contracts (salary_type, monthly_salary, standard_working_days, tax_method)



UPDATE dbo.contracts



SET salary_type = ISNULL(salary_type, 'daily'),



    standard_working_days = ISNULL(standard_working_days, 26),



    monthly_salary = ISNULL(monthly_salary, daily_rate * ISNULL(standard_working_days, 26)),



    tax_method = ISNULL(tax_method, 'progressive');







-- Insert initial salary history for existing contracts if not present



INSERT INTO dbo.contract_salary_histories (history_id, contract_id, salary_type, daily_rate, monthly_salary, standard_working_days, insurance_salary_basis, tax_method, effective_from, effective_to, note, created_at)



SELECT NEWID(), c.contract_id, c.salary_type, c.daily_rate, c.monthly_salary, c.standard_working_days, c.insurance_salary_basis, c.tax_method, c.effective_from, c.effective_to, N'Khởi tạo từ hợp đồng hiện tại', SYSUTCDATETIME()



FROM dbo.contracts c



WHERE NOT EXISTS (



    SELECT 1 FROM dbo.contract_salary_histories h WHERE h.contract_id = c.contract_id



);







-- 4. Payroll rate configs



DECLARE @bsPosId uniqueidentifier;



SELECT TOP 1 @bsPosId = position_id FROM dbo.positions WHERE name LIKE N'%Bác sĩ%' OR scope_tag = 'doctor';







IF NOT EXISTS (SELECT 1 FROM dbo.payroll_rate_configs WHERE code = 'duty_night' AND position_id IS NULL AND staff_id IS NULL)



BEGIN



    INSERT INTO dbo.payroll_rate_configs (config_id, code, position_id, staff_id, rate_value, unit, description, effective_from, status, created_at)



    VALUES (NEWID(), 'duty_night', NULL, NULL, 100000, 'vnd', N'Trực tối (chung)', '2026-01-01', 'active', SYSUTCDATETIME());



END







IF @bsPosId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.payroll_rate_configs WHERE code = 'duty_night' AND position_id = @bsPosId)



BEGIN



    INSERT INTO dbo.payroll_rate_configs (config_id, code, position_id, staff_id, rate_value, unit, description, effective_from, status, created_at)



    VALUES (NEWID(), 'duty_night', @bsPosId, NULL, 200000, 'vnd', N'Trực tối (Bác sĩ)', '2026-01-01', 'active', SYSUTCDATETIME());



END







IF NOT EXISTS (SELECT 1 FROM dbo.payroll_rate_configs WHERE code = 'duty_noon' AND position_id IS NULL AND staff_id IS NULL)



BEGIN



    INSERT INTO dbo.payroll_rate_configs (config_id, code, position_id, staff_id, rate_value, unit, description, effective_from, status, created_at)



    VALUES (NEWID(), 'duty_noon', NULL, NULL, 50000, 'vnd', N'Trực trưa', '2026-01-01', 'active', SYSUTCDATETIME());



END







IF NOT EXISTS (SELECT 1 FROM dbo.payroll_rate_configs WHERE code = 'duty_extra_hour_multiplier' AND position_id IS NULL AND staff_id IS NULL)



BEGIN



    INSERT INTO dbo.payroll_rate_configs (config_id, code, position_id, staff_id, rate_value, unit, description, effective_from, status, created_at)



    VALUES (NEWID(), 'duty_extra_hour_multiplier', NULL, NULL, 150, 'percent', N'Hệ số trực ngoài giờ', '2026-01-01', 'active', SYSUTCDATETIME());



END







IF NOT EXISTS (SELECT 1 FROM dbo.payroll_rate_configs WHERE code = 'union_fee' AND position_id IS NULL AND staff_id IS NULL)



BEGIN



    INSERT INTO dbo.payroll_rate_configs (config_id, code, position_id, staff_id, rate_value, unit, description, effective_from, status, created_at)



    VALUES (NEWID(), 'union_fee', NULL, NULL, 100000, 'vnd', N'Đoàn phí công đoàn', '2026-01-01', 'active', SYSUTCDATETIME());



END







IF NOT EXISTS (SELECT 1 FROM dbo.payroll_rate_configs WHERE code = 'standard_working_days' AND position_id IS NULL AND staff_id IS NULL)



BEGIN



    INSERT INTO dbo.payroll_rate_configs (config_id, code, position_id, staff_id, rate_value, unit, description, effective_from, status, created_at)



    VALUES (NEWID(), 'standard_working_days', NULL, NULL, 26, 'days', N'Số ngày công chuẩn mặc định', '2026-01-01', 'active', SYSUTCDATETIME());



END







-- 5. Allowance types



UPDATE dbo.allowance_types



SET name = N'Ăn trưa', default_calc_method = 'prorate_by_workdays'



WHERE code = 'LUNCH';







IF NOT EXISTS (SELECT 1 FROM dbo.allowance_types WHERE code = 'ALLOW_BASIC')



BEGIN



    INSERT INTO dbo.allowance_types (allowance_id, code, name, value_type, default_value, applies_to, default_calc_method, min_service_years, is_taxable, is_insurance_basis, status, created_at)



    VALUES (NEWID(), 'ALLOW_BASIC', N'Phụ cấp cơ bản', 'fixed', 0, 'all', 'fixed', NULL, 1, 0, 'active', SYSUTCDATETIME());



END







IF NOT EXISTS (SELECT 1 FROM dbo.allowance_types WHERE code = 'ALLOW_HAZARD')



BEGIN



    INSERT INTO dbo.allowance_types (allowance_id, code, name, value_type, default_value, applies_to, default_calc_method, min_service_years, is_taxable, is_insurance_basis, status, created_at)



    VALUES (NEWID(), 'ALLOW_HAZARD', N'Phụ cấp độc hại', 'fixed', 0, 'all', 'fixed', NULL, 0, 0, 'active', SYSUTCDATETIME());



END







IF NOT EXISTS (SELECT 1 FROM dbo.allowance_types WHERE code = 'ALLOW_RESPONSIBILITY')



BEGIN



    INSERT INTO dbo.allowance_types (allowance_id, code, name, value_type, default_value, applies_to, default_calc_method, min_service_years, is_taxable, is_insurance_basis, status, created_at)



    VALUES (NEWID(), 'ALLOW_RESPONSIBILITY', N'Phụ cấp trách nhiệm', 'fixed', 0, 'all', 'fixed', NULL, 1, 0, 'active', SYSUTCDATETIME());



END







IF NOT EXISTS (SELECT 1 FROM dbo.allowance_types WHERE code = 'ALLOW_INS_SIGN')



BEGIN



    INSERT INTO dbo.allowance_types (allowance_id, code, name, value_type, default_value, applies_to, default_calc_method, min_service_years, is_taxable, is_insurance_basis, status, created_at)



    VALUES (NEWID(), 'ALLOW_INS_SIGN', N'Phụ cấp ký bảo hiểm', 'fixed', 0, 'all', 'fixed', NULL, 1, 0, 'active', SYSUTCDATETIME());



END







IF NOT EXISTS (SELECT 1 FROM dbo.allowance_types WHERE code = 'ALLOW_PRACTICE_CERT')



BEGIN



    INSERT INTO dbo.allowance_types (allowance_id, code, name, value_type, default_value, applies_to, default_calc_method, min_service_years, is_taxable, is_insurance_basis, status, created_at)



    VALUES (NEWID(), 'ALLOW_PRACTICE_CERT', N'Phụ cấp chứng chỉ hành nghề', 'fixed', 0, 'all', 'fixed', NULL, 1, 0, 'active', SYSUTCDATETIME());



END







IF NOT EXISTS (SELECT 1 FROM dbo.allowance_types WHERE code = 'ALLOW_SENIORITY')



BEGIN



    INSERT INTO dbo.allowance_types (allowance_id, code, name, value_type, default_value, applies_to, default_calc_method, min_service_years, is_taxable, is_insurance_basis, status, created_at)



    VALUES (NEWID(), 'ALLOW_SENIORITY', N'Phụ cấp thâm niên', 'fixed', 50000, 'all', 'per_service_year', 3, 1, 0, 'active', SYSUTCDATETIME());



END







-- 6. Tax brackets (Decree 253/2026/NĐ-CP & 2026 5 brackets)



UPDATE dbo.payroll_tax_brackets



SET status = 'inactive', effective_to = '2025-12-31'



WHERE effective_from < '2026-01-01' AND (effective_to IS NULL OR effective_to >= '2026-01-01');







IF NOT EXISTS (SELECT 1 FROM dbo.payroll_tax_brackets WHERE effective_from = '2026-01-01')



BEGIN



    INSERT INTO dbo.payroll_tax_brackets (bracket_id, income_from, income_to, tax_rate_percent, effective_from, effective_to, status)



    VALUES



    (NEWID(), 0, 10000000, 5.0, '2026-01-01', NULL, 'active'),



    (NEWID(), 10000000, 30000000, 10.0, '2026-01-01', NULL, 'active'),



    (NEWID(), 30000000, 60000000, 20.0, '2026-01-01', NULL, 'active'),



    (NEWID(), 60000000, 100000000, 30.0, '2026-01-01', NULL, 'active'),



    (NEWID(), 100000000, NULL, 35.0, '2026-01-01', NULL, 'active');



END







-- Update base prices for procedure services



UPDATE dbo.procedure_services SET base_price = 500000 WHERE service_code IN ('82', '85');



UPDATE dbo.procedure_services SET base_price = 200000 WHERE service_code = '87';



UPDATE dbo.procedure_services SET base_price = 700000 WHERE service_code IN ('88', '81');



UPDATE dbo.procedure_services SET base_price = 120000 WHERE service_code IN ('86', '2', '3', '11', '13', '14', '22', '24', '26');



UPDATE dbo.procedure_services SET base_price = 500000 WHERE service_code IN ('5', '6');



UPDATE dbo.procedure_services SET base_price = 150000 WHERE service_code IN ('15', '18', '20', '21', 'SA_DAUDO', '27', '117', '238');



UPDATE dbo.procedure_services SET base_price = 180000 WHERE service_code IN ('19', '23');



UPDATE dbo.procedure_services SET base_price = 250000 WHERE service_code IN ('115', '242');



UPDATE dbo.procedure_services SET base_price = 400000 WHERE service_code = '116';



UPDATE dbo.procedure_services SET base_price = 550000 WHERE service_code = '236';



UPDATE dbo.procedure_services SET base_price = 100000 WHERE service_code = '239';



");



        }







        /// <inheritdoc />



        protected override void Down(MigrationBuilder migrationBuilder)



        {



            migrationBuilder.DropForeignKey(



                name: "FK_commission_rules_positions_position_id",



                schema: "dbo",



                table: "commission_rules");







            migrationBuilder.DropForeignKey(



                name: "FK_procedure_slips_staff_indicating_staff_id",



                schema: "dbo",



                table: "procedure_slips");







            migrationBuilder.DropForeignKey(



                name: "FK_staff_sites_site_id",



                schema: "dbo",



                table: "staff");







            migrationBuilder.DropTable(



                name: "contract_salary_histories",



                schema: "dbo");







            // leave_types preserved







            migrationBuilder.DropTable(



                name: "payroll_rate_configs",



                schema: "dbo");







            migrationBuilder.DropTable(



                name: "sites",



                schema: "dbo");







            migrationBuilder.DropTable(



                name: "staff_commission_overrides",



                schema: "dbo");







            migrationBuilder.DropIndex(



                name: "IX_staff_site_id",



                schema: "dbo",



                table: "staff");







            migrationBuilder.DropIndex(



                name: "IX_procedure_slips_indicating_staff_id",



                schema: "dbo",



                table: "procedure_slips");







            migrationBuilder.DropCheckConstraint(



                name: "CK_contracts_2",



                schema: "dbo",



                table: "contracts");







            migrationBuilder.DropIndex(



                name: "IX_commission_rules_position_id",



                schema: "dbo",



                table: "commission_rules");







            migrationBuilder.DropCheckConstraint(



                name: "CK_commission_rules_3",



                schema: "dbo",



                table: "commission_rules");







            migrationBuilder.DropColumn(



                name: "calc_method",



                schema: "dbo",



                table: "staff_allowances");







            migrationBuilder.DropColumn(



                name: "is_union_member",



                schema: "dbo",



                table: "staff");







            migrationBuilder.DropColumn(



                name: "site_id",



                schema: "dbo",



                table: "staff");







            migrationBuilder.DropColumn(



                name: "charged_amount",



                schema: "dbo",



                table: "procedure_slips");







            migrationBuilder.DropColumn(



                name: "direct_cost",



                schema: "dbo",



                table: "procedure_slips");







            migrationBuilder.DropColumn(



                name: "duration_hours",



                schema: "dbo",



                table: "procedure_slips");







            migrationBuilder.DropColumn(



                name: "indicating_staff_id",



                schema: "dbo",



                table: "procedure_slips");







            migrationBuilder.DropColumn(



                name: "is_after_hours",



                schema: "dbo",



                table: "procedure_slips");







            migrationBuilder.DropColumn(



                name: "base_price",



                schema: "dbo",



                table: "procedure_services");







            migrationBuilder.DropColumn(



                name: "monthly_salary",



                schema: "dbo",



                table: "contracts");







            migrationBuilder.DropColumn(



                name: "salary_type",



                schema: "dbo",



                table: "contracts");







            migrationBuilder.DropColumn(



                name: "standard_working_days",



                schema: "dbo",



                table: "contracts");







            migrationBuilder.DropColumn(



                name: "tax_method",



                schema: "dbo",



                table: "contracts");







            migrationBuilder.DropColumn(



                name: "position_id",



                schema: "dbo",



                table: "commission_rules");







            migrationBuilder.DropColumn(



                name: "service_category",



                schema: "dbo",



                table: "commission_rules");







            migrationBuilder.DropColumn(



                name: "time_condition",



                schema: "dbo",



                table: "commission_rules");







            migrationBuilder.DropColumn(



                name: "default_calc_method",



                schema: "dbo",



                table: "allowance_types");







            migrationBuilder.DropColumn(



                name: "min_service_years",



                schema: "dbo",



                table: "allowance_types");







            migrationBuilder.AlterColumn<Guid>(



                name: "service_id",



                schema: "dbo",



                table: "commission_rules",



                type: "uniqueidentifier",



                nullable: false,



                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),



                oldClrType: typeof(Guid),



                oldType: "uniqueidentifier",



                oldNullable: true);







            migrationBuilder.AddCheckConstraint(



                name: "CK_contracts_2",



                schema: "dbo",



                table: "contracts",



                sql: "[daily_rate] >= 0 AND ([insurance_salary_basis] IS NULL OR [insurance_salary_basis] >= 0)");



        }



    }



}



