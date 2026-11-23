using System.Text.Json;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Deals;

public sealed class PublishedDeal
{
    public Guid GameId { get; init; }
    public required string Shop { get; init; }
    public required string Title { get; init; }
    public required string Currency { get; init; }
    public decimal Price { get; init; }
    public int Discount { get; init; }
    public bool Popular { get; init; }
    public DateTimeOffset ExpiresAt { get; init; }
    public required string Data { get; init; }
}

public sealed class StoredDeals(BacklogDbContext db, TimeProvider clock) : IGameDeals
{
    private const int PageSize = 20;

    public bool IsConfigured => true;

    public Task<GameDealsPage> Search(string title, DealSort sort, DealShop? shop, CancellationToken ct)
    {
        var term = title.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
        return Read(Active(shop).Where(deal => EF.Functions.ILike(deal.Title, "%" + term + "%")),
            0, sort, paginate: false, ct);
    }

    public Task<GameDealsPage> List(int offset, DealSort sort, DealShop? shop, bool popular, CancellationToken ct) =>
        Read(Active(shop).Where(deal => !popular || deal.Popular), offset, sort, paginate: true, ct);

    public async Task Publish(GameDeal deal, bool popular, DateTimeOffset expiresAt, CancellationToken ct)
    {
        var data = JsonSerializer.Serialize(deal);
        var shop = deal.Shop.Trim().ToLowerInvariant();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "PublishedDeals" ("GameId", "Shop", "Title", "Currency", "Price", "Discount", "Popular", "ExpiresAt", "Data")
            VALUES ({deal.Id}, {shop}, {deal.Title}, {deal.Currency}, {deal.Price}, {deal.Discount}, {popular}, {expiresAt}, {data})
            ON CONFLICT ("GameId", "Shop") DO UPDATE SET
                "Title" = EXCLUDED."Title", "Currency" = EXCLUDED."Currency", "Price" = EXCLUDED."Price",
                "Discount" = EXCLUDED."Discount", "Popular" = "PublishedDeals"."Popular" OR EXCLUDED."Popular",
                "ExpiresAt" = EXCLUDED."ExpiresAt", "Data" = EXCLUDED."Data"
            WHERE "PublishedDeals"."ExpiresAt" <= EXCLUDED."ExpiresAt"
            """, ct);
    }

    public Task<int> InsertMissing(IEnumerable<GameDeal> deals, DateTimeOffset expiresAt, CancellationToken ct)
    {
        var rows = JsonSerializer.Serialize(deals.Select(deal => new
        {
            GameId = deal.Id,
            Shop = deal.Shop.Trim().ToLowerInvariant(),
            deal.Title,
            deal.Currency,
            deal.Price,
            deal.Discount,
            Data = JsonSerializer.Serialize(deal)
        }));

        return db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "PublishedDeals" ("GameId", "Shop", "Title", "Currency", "Price", "Discount", "Popular", "ExpiresAt", "Data")
            SELECT "GameId", "Shop", "Title", "Currency", "Price", "Discount", TRUE, {expiresAt}, "Data"
            FROM jsonb_to_recordset(CAST({rows} AS jsonb)) AS deals(
                "GameId" uuid, "Shop" text, "Title" text, "Currency" text, "Price" numeric, "Discount" integer, "Data" text)
            ORDER BY "GameId", "Shop"
            ON CONFLICT ("GameId", "Shop") DO NOTHING
            """, ct);
    }

    private IQueryable<PublishedDeal> Active(DealShop? shop)
    {
        var now = clock.GetUtcNow();
        var offers = db.Set<PublishedDeal>().Where(deal => deal.ExpiresAt > now);
        if (shop is null) return offers;

        var name = shop.Value.ToString().ToLowerInvariant();
        return offers.Where(deal => deal.Shop == name);
    }

    private static async Task<GameDealsPage> Read(IQueryable<PublishedDeal> offers, int offset,
        DealSort sort, bool paginate, CancellationToken ct)
    {
        var ordered = sort == DealSort.Price
            ? offers.OrderBy(deal => deal.Currency).ThenBy(deal => deal.Price)
            : offers.OrderByDescending(deal => deal.Discount).ThenBy(deal => deal.Title);
        var rows = await ordered.ThenBy(deal => deal.GameId).ThenBy(deal => deal.Shop)
            .Skip(offset).Take(PageSize + 1).Select(deal => deal.Data).ToListAsync(ct);
        return new(rows.Take(PageSize).Select(ReadOffer).ToArray(),
            paginate && rows.Count > PageSize ? offset + PageSize : null);
    }

    private static GameDeal ReadOffer(string data)
    {
        var deal = JsonSerializer.Deserialize<GameDeal>(data)!;
        return string.IsNullOrWhiteSpace(deal.CoverUrl)
            ? deal with { CoverUrl = IsThereAnyDeal.CoverFor(deal.Id) }
            : deal;
    }
}
