using GamesBacklog.Domain;
using GamesBacklog.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Persistence;

public sealed class BacklogDbContext(DbContextOptions<BacklogDbContext> options) : DbContext(options)
{
    internal const string ImportIndex = "IX_Backlog_Owner_Rawg_Platform";
    internal const string EmailIndex = "IX_Users_NormalizedEmail";
    internal const string UserNameIndex = "IX_Users_NormalizedUserName";

    public DbSet<BacklogEntry> Backlog => Set<BacklogEntry>();
    public DbSet<BacklogUser> Users => Set<BacklogUser>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<BacklogUser>(user =>
        {
            user.Property(x => x.Email).HasMaxLength(256).IsRequired();
            user.Property(x => x.NormalizedEmail).HasMaxLength(256).IsRequired();
            user.Property(x => x.UserName).HasMaxLength(256).IsRequired();
            user.Property(x => x.NormalizedUserName).HasMaxLength(256).IsRequired();
            user.Property(x => x.ConcurrencyStamp).IsConcurrencyToken();
            user.HasIndex(x => x.NormalizedEmail).IsUnique().HasDatabaseName(EmailIndex);
            user.HasIndex(x => x.NormalizedUserName).IsUnique().HasDatabaseName(UserNameIndex);
        });

        model.Entity<BacklogEntry>(entry =>
        {
            entry.Property(x => x.Title).HasMaxLength(250).IsRequired();
            entry.Property(x => x.Platform).HasMaxLength(100).IsRequired();
            entry.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
            entry.HasOne<BacklogUser>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
            entry.HasIndex(x => new { x.OwnerId, x.CreatedAt, x.Id }).IsDescending(false, true, true);
            entry.HasIndex(x => new { x.OwnerId, x.RawgId, x.PlatformId }).IsUnique()
                .HasFilter("\"RawgId\" IS NOT NULL").HasDatabaseName(ImportIndex);
        });
    }
}
