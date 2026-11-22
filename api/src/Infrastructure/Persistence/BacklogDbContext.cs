using GamesBacklog.Domain;
using GamesBacklog.Infrastructure.Identity;
using GamesBacklog.Infrastructure.Steam;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Persistence;

public sealed class BacklogDbContext(DbContextOptions<BacklogDbContext> options) : DbContext(options)
{
    internal const string ImportIndex = "IX_Backlog_Owner_Rawg_Platform";
    internal const string EmailIndex = "IX_Users_NormalizedEmail";
    internal const string UserNameIndex = "IX_Users_NormalizedUserName";
    internal const string SteamUserIndex = "IX_Users_SteamId";
    internal const string SteamNonceIndex = "IX_SteamLoginFlows_Nonce";

    public DbSet<BacklogEntry> Backlog => Set<BacklogEntry>();
    public DbSet<BacklogUser> Users => Set<BacklogUser>();
    public DbSet<SteamLoginFlow> SteamLoginFlows => Set<SteamLoginFlow>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<BacklogUser>(user =>
        {
            user.Property(x => x.Email).HasMaxLength(256);
            user.Property(x => x.NormalizedEmail).HasMaxLength(256);
            user.Property(x => x.UserName).HasMaxLength(256).IsRequired();
            user.Property(x => x.NormalizedUserName).HasMaxLength(256).IsRequired();
            user.Property(x => x.ConcurrencyStamp).IsConcurrencyToken();
            user.HasIndex(x => x.NormalizedEmail).IsUnique().HasDatabaseName(EmailIndex);
            user.HasIndex(x => x.NormalizedUserName).IsUnique().HasDatabaseName(UserNameIndex);
            user.Property(x => x.SteamId).HasMaxLength(17);
            user.HasIndex(x => x.SteamId).IsUnique().HasDatabaseName(SteamUserIndex);
            user.Property(x => x.DisplayName).HasMaxLength(60);
            user.Property(x => x.Bio).HasMaxLength(300);
            user.Property(x => x.AvatarUrl).HasColumnType("text");
            user.Property(x => x.HeaderUrl).HasColumnType("text");
        });

        model.Entity<SteamLoginFlow>(flow =>
        {
            flow.HasKey(x => x.State);
            flow.Property(x => x.State).HasMaxLength(43);
            flow.Property(x => x.Challenge).HasMaxLength(43);
            flow.Property(x => x.SteamId).HasMaxLength(17);
            flow.Property(x => x.CodeHash).HasMaxLength(43);
            flow.Property(x => x.Nonce).HasMaxLength(255);
            flow.HasIndex(x => x.Nonce).IsUnique().HasDatabaseName(SteamNonceIndex);
            flow.HasIndex(x => x.ExpiresAt);
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
