using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Configurations.Entities;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Models.Auth;
namespace Vnc.HRMS.Persistence;
public sealed class IamDbContext(DbContextOptions<IamDbContext> options) : TimestampDbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Credential> Credentials => Set<Credential>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        DomainModelConfiguration.Configure(modelBuilder);
        UsersModelConfiguration.Configure(modelBuilder);
        AuthModelConfiguration.Configure(modelBuilder);
    }
}
