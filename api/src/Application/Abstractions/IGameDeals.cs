namespace GamesBacklog.Application;

public enum DealSort { Discount, Price }
public enum DealShop { Steam, Gog, Nuuvem }

public sealed record GameDeal(Guid Id, string Title, string Shop, decimal Price,
    decimal? RegularPrice, string Currency, int Discount, string Url, string? CoverUrl);
public sealed record GameDealsPage(IReadOnlyList<GameDeal> Items, int? NextOffset);

public interface IGameDeals
{
    bool IsConfigured { get; }
    Task<GameDealsPage> Search(string title, DealSort sort, DealShop? shop, CancellationToken ct);
    Task<GameDealsPage> List(int offset, DealSort sort, DealShop? shop, bool popular, CancellationToken ct);
}
