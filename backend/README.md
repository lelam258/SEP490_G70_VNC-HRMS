# Backend (.NET 8)

- `src/Common.Security`: shared JWT bearer validation setup.
- `src/AuthService`: authentication service boundary.
- `src/UserService`: UC-01 account management boundary.
- `src/OrganizationService`: UC-07 organization structure boundary.
- `src/EmployeeService`: UC-07 employee profile boundary.

Set `Jwt__SigningKey` as an environment secret (minimum 32 bytes for HS256); no signing key is committed. Restore/build with `dotnet restore VNC.HRMS.sln` and `dotnet build VNC.HRMS.sln`. Run a service with `dotnet run --project src/AuthService`.

EF Core 8 SQL Server persistence and initial migrations are implemented for the Iteration 1 entities. Login and account/department/employee CRUD endpoints are still placeholders; no users or passwords are seeded.

## Database ownership

Development uses one database, `VNC_HRMS_Iteration1`, with isolated schemas:

| Service | DbContext | Schema | Tables |
| --- | --- | --- | --- |
| AuthService | AuthDbContext | auth | credentials, refresh_tokens |
| UserService | UserDbContext | users | users |
| OrganizationService | OrganizationDbContext | organization | departments, positions |
| EmployeeService | EmployeeDbContext | employees | staff, contracts, degrees |

Each service keeps its own `__EFMigrationsHistory` table in its schema. There are no foreign keys or EF navigation properties across service boundaries. User IDs are assigned by UserService and reused by Auth credentials and employee profiles; account provisioning must coordinate these through APIs/events when implemented. Services must not query another service's tables. Schema separation is logical isolation; production SQL permissions must enforce ownership.

This is an adaptation of the supplied SQL design, not an exact copy: authentication fields are separated from users, nullable unique fields use filtered indexes, and timestamps are UTC. `SaveChanges` updates `updated_at` and preserves `created_at`; raw SQL and `ExecuteUpdate` callers must manage timestamps themselves. Payroll, attendance, compliance, notifications, audit logs and system policies are outside this initial persistence change.

## Create tables with Code First

Run from `backend/`. Do not run the original SQL CREATE TABLE script or scaffold the database.

```powershell
dotnet restore VNC.HRMS.sln
dotnet build VNC.HRMS.sln --no-restore
dotnet tool install --global dotnet-ef --version 8.0.11
```

If dotnet-ef is already installed, use `dotnet tool update --global dotnet-ef --version 8.0.11` instead. Use EF 8 tools for this .NET 8 solution.

The checked-in connection string assumes local SQL Server with Windows Authentication. Replace the server below with the Server name from SSMS, for example `localhost\SQLEXPRESS`:

```powershell
.\scripts\Update-Database.ps1 -ConnectionString 'Server=localhost;Database=VNC_HRMS_Iteration1;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;'
```

The script applies the four existing initial migrations sequentially. The SQL login needs permission to create schemas/tables (and to create the database if it does not exist). It stops on failure; earlier services may already have migrated, so fix the failure and rerun. Applied migrations are skipped. No automatic migration runs at API startup.

For one service:

```powershell
$env:ConnectionStrings__DefaultConnection = 'Server=localhost;Database=VNC_HRMS_Iteration1;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;'
dotnet ef database update --project src/OrganizationService
```

For SQL Authentication, supply `User Id=...;Password=...;` instead of `Integrated Security=True;` through user secrets or environment configuration. Never commit credentials. `TrustServerCertificate=True` is for local development; production should validate the server certificate.

To persist local configuration per service:

```powershell
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' 'Server=localhost;Database=VNC_HRMS_Iteration1;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;' --project src/OrganizationService
```

Repeat for each service as needed. Runtime loads user secrets in Development. Design-time factories read appsettings, user secrets, environment variables and command-line overrides without requiring a JWT secret or database connection to generate migrations. EF may log a startup JWT warning before falling back to the factory; migration commands can still succeed. Applying migrations does require a reachable SQL Server.

## Future model changes

Change the owning service's model/configuration, then create and review its migration:

```powershell
dotnet ef migrations add DescribeChange --project src/OrganizationService --output-dir Data/Migrations
dotnet ef migrations script --idempotent --project src/OrganizationService --output organization.sql
dotnet ef migrations has-pending-model-changes --project src/OrganizationService
```

Review generated SQL before applying it to shared environments. Commit entities, context/configuration, migration files and the model snapshot together.
