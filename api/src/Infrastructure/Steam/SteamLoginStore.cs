using GamesBacklog.Infrastructure.Identity;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GamesBacklog.Infrastructure.Steam;

public sealed class SteamLoginStore(BacklogDbContext db)
{
    public async Task Start(SteamLoginFlow flow, long pruneBefore, CancellationToken ct)
    {
        await db.SteamLoginFlows.Where(x => x.ExpiresAt < pruneBefore).ExecuteDeleteAsync(ct);
        db.SteamLoginFlows.Add(flow);
        await db.SaveChangesAsync(ct);
    }

    public Task<bool> IsPending(string state, long now, CancellationToken ct) =>
        db.SteamLoginFlows.AnyAsync(x => x.State == state && x.ExpiresAt > now && x.Nonce == null, ct);

    public async Task<bool> Complete(string state, SteamAssertion assertion, string codeHash, long now, CancellationToken ct)
    {
        try
        {
            return await db.SteamLoginFlows.Where(x => x.State == state && x.ExpiresAt > now && x.Nonce == null)
                .ExecuteUpdateAsync(update => update
                    .SetProperty(x => x.Nonce, assertion.Nonce)
                    .SetProperty(x => x.SteamId, assertion.SteamId)
                    .SetProperty(x => x.CodeHash, codeHash), ct) == 1;
        }
        catch (PostgresException error) when (error.SqlState == PostgresErrorCodes.UniqueViolation &&
            error.ConstraintName == BacklogDbContext.SteamNonceIndex)
        {
            return false;
        }
    }

    public async Task<string?> Redeem(string state, string codeHash, string challenge, Guid? ownerId, long now,
        CancellationToken ct)
    {
        var exchange = db.SteamLoginFlows.Where(x => x.State == state && x.CodeHash == codeHash &&
            x.ExpiresAt > now && x.LinkOwnerId == ownerId && x.Challenge == challenge);
        var steamId = await exchange.Select(x => x.SteamId).SingleOrDefaultAsync(ct);
        if (steamId is null) return null;

        return await exchange.ExecuteUpdateAsync(update => update.SetProperty(x => x.CodeHash, (string?)null), ct) == 1
            ? steamId : null;
    }

    public Task<BacklogUser?> FindUser(string steamId, CancellationToken ct) =>
        db.Users.SingleOrDefaultAsync(user => user.SteamId == steamId, ct);
}
