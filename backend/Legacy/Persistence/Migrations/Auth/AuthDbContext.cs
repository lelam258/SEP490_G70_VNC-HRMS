using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models.Auth;
using Vnc.HRMS.Configurations.Entities;

namespace Vnc.HRMS.Persistence.Migrations.Auth;

public sealed class AuthDbContext(DbContextOptions<AuthDbContext> options) : TimestampDbContext(options)
{
    public DbSet<Credential> Credentials => Set<Credential>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) { modelBuilder.HasDefaultSchema("auth"); AuthModelConfiguration.Configure(modelBuilder); }
}
