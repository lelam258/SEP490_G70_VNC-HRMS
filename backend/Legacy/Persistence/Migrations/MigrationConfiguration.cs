namespace Vnc.HRMS.Persistence.Migrations;

public static class MigrationConfiguration
{
    public static IConfiguration Load(string[] args) => new ConfigurationBuilder()
        .SetBasePath(Directory.GetCurrentDirectory())
        .AddJsonFile("appsettings.json", optional: true)
        .AddUserSecrets<Program>(optional: true)
        .AddEnvironmentVariables()
        .AddCommandLine(args)
        .Build();
}
