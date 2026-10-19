using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Vnc.HRMS.UserService.Data;

public static class DatabaseConfiguration
{
    public static void AddServiceDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<UserDbContext>(options => Configure(options, configuration));
    }

    public static void Configure(DbContextOptionsBuilder options, IConfiguration configuration)
    {
        var connection = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Set ConnectionStrings:DefaultConnection for SQL Server.");
        options.UseSqlServer(connection, sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "users"));
    }
}

// EF tooling bypasses application startup, so generating migrations needs no JWT signing key.
public sealed class UserDbContextFactory : IDesignTimeDbContextFactory<UserDbContext>
{
    public UserDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        var configuration = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddUserSecrets<UserDbContextFactory>(optional: true)
            .AddEnvironmentVariables()
            .AddCommandLine(args)
            .Build();
        var options = new DbContextOptionsBuilder<UserDbContext>();
        DatabaseConfiguration.Configure(options, configuration);
        return new UserDbContext(options.Options);
    }
}

