using GamesBacklog.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GamesBacklog.Infrastructure.Identity;

public sealed class BacklogUserStore(BacklogDbContext db, IdentityErrorDescriber errors) :
    IUserPasswordStore<BacklogUser>, IUserEmailStore<BacklogUser>, IUserSecurityStampStore<BacklogUser>,
    IUserLockoutStore<BacklogUser>
{
    public async Task<IdentityResult> CreateAsync(BacklogUser user, CancellationToken ct)
    {
        db.Users.Add(user);
        return await Save(user, ct);
    }

    public async Task<IdentityResult> UpdateAsync(BacklogUser user, CancellationToken ct)
    {
        if (db.Entry(user).State == EntityState.Detached)
            db.Users.Attach(user);
        user.ConcurrencyStamp = Guid.NewGuid().ToString();
        db.Users.Update(user);
        return await Save(user, ct);
    }

    public async Task<IdentityResult> DeleteAsync(BacklogUser user, CancellationToken ct)
    {
        db.Users.Remove(user);
        return await Save(user, ct);
    }

    private async Task<IdentityResult> Save(BacklogUser user, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return IdentityResult.Success;
        }
        catch (DbUpdateConcurrencyException)
        {
            db.Entry(user).State = EntityState.Detached;
            return IdentityResult.Failed(errors.ConcurrencyFailure());
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
            {
                SqlState: PostgresErrorCodes.UniqueViolation,
                ConstraintName: BacklogDbContext.EmailIndex or BacklogDbContext.UserNameIndex
            })
        {
            db.Entry(user).State = EntityState.Detached;
            return IdentityResult.Failed(errors.DuplicateEmail(user.Email!));
        }
    }

    public Task<BacklogUser?> FindByIdAsync(string id, CancellationToken ct) =>
        Guid.TryParse(id, out var key)
            ? db.Users.SingleOrDefaultAsync(user => user.Id == key, ct)
            : Task.FromResult<BacklogUser?>(null);

    public Task<BacklogUser?> FindByNameAsync(string normalizedUserName, CancellationToken ct) =>
        db.Users.SingleOrDefaultAsync(user => user.NormalizedUserName == normalizedUserName, ct);

    public Task<BacklogUser?> FindByEmailAsync(string normalizedEmail, CancellationToken ct) =>
        db.Users.SingleOrDefaultAsync(user => user.NormalizedEmail == normalizedEmail, ct);

    public Task<string> GetUserIdAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.Id.ToString());
    public Task<string?> GetUserNameAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.UserName);
    public Task<string?> GetNormalizedUserNameAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.NormalizedUserName);
    public Task<string?> GetPasswordHashAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.PasswordHash);
    public Task<bool> HasPasswordAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.PasswordHash is not null);
    public Task<string?> GetEmailAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.Email);
    public Task<string?> GetNormalizedEmailAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.NormalizedEmail);
    public Task<bool> GetEmailConfirmedAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.EmailConfirmed);
    public Task<string?> GetSecurityStampAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.SecurityStamp);
    public Task<DateTimeOffset?> GetLockoutEndDateAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.LockoutEnd);
    public Task<int> GetAccessFailedCountAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.AccessFailedCount);
    public Task<bool> GetLockoutEnabledAsync(BacklogUser user, CancellationToken ct) => Task.FromResult(user.LockoutEnabled);

    public Task SetUserNameAsync(BacklogUser user, string? value, CancellationToken ct)
    {
        user.UserName = value;
        return Task.CompletedTask;
    }

    public Task SetNormalizedUserNameAsync(BacklogUser user, string? value, CancellationToken ct)
    {
        user.NormalizedUserName = value;
        return Task.CompletedTask;
    }

    public Task SetPasswordHashAsync(BacklogUser user, string? value, CancellationToken ct)
    {
        user.PasswordHash = value;
        return Task.CompletedTask;
    }

    public Task SetEmailAsync(BacklogUser user, string? value, CancellationToken ct)
    {
        user.Email = value;
        return Task.CompletedTask;
    }

    public Task SetNormalizedEmailAsync(BacklogUser user, string? value, CancellationToken ct)
    {
        user.NormalizedEmail = value;
        return Task.CompletedTask;
    }

    public Task SetEmailConfirmedAsync(BacklogUser user, bool value, CancellationToken ct)
    {
        user.EmailConfirmed = value;
        return Task.CompletedTask;
    }

    public Task SetSecurityStampAsync(BacklogUser user, string value, CancellationToken ct)
    {
        user.SecurityStamp = value;
        return Task.CompletedTask;
    }

    public Task SetLockoutEndDateAsync(BacklogUser user, DateTimeOffset? value, CancellationToken ct)
    {
        user.LockoutEnd = value;
        return Task.CompletedTask;
    }

    public Task<int> IncrementAccessFailedCountAsync(BacklogUser user, CancellationToken ct) =>
        Task.FromResult(++user.AccessFailedCount);

    public Task ResetAccessFailedCountAsync(BacklogUser user, CancellationToken ct)
    {
        user.AccessFailedCount = 0;
        return Task.CompletedTask;
    }

    public Task SetLockoutEnabledAsync(BacklogUser user, bool value, CancellationToken ct)
    {
        user.LockoutEnabled = value;
        return Task.CompletedTask;
    }

    public void Dispose() { }
}
