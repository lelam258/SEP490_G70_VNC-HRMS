using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Configurations.Entities;

namespace Vnc.HRMS.Persistence.Migrations.Users;

public sealed class UserDbContext(DbContextOptions<UserDbContext> options) : TimestampDbContext(options)
{
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) { modelBuilder.HasDefaultSchema("users"); UsersModelConfiguration.Configure(modelBuilder); }
}
