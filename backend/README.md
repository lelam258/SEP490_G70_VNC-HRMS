# Backend (.NET 8)

- `src/Common.Security`: shared JWT bearer validation setup.
- `src/AuthService`: authentication service boundary.
- `src/UserService`: UC-01 account management boundary.
- `src/OrganizationService`: UC-07 organization structure boundary.
- `src/EmployeeService`: UC-07 employee profile boundary.

Set `Jwt__SigningKey` as an environment secret (minimum 32 bytes for HS256); no signing key is committed. Restore/build with `dotnet restore VNC.HRMS.sln` and `dotnet build VNC.HRMS.sln`. Run a service with `dotnet run --project src/AuthService`.

This commit is a scaffold: login, persistence, account/department/employee CRUD, and production secret management remain to implement.
