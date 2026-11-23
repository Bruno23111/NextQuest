using FluentValidation;

namespace GamesBacklog.Api.Endpoints;

internal sealed record PopularBatch(int Count)
{
    internal void Validate()
    {
        if (Count is not (10 or 50 or 100 or 200 or 500))
            throw new ValidationException([new("count", "Escolha 10, 50, 100, 200 ou 500.")]);
    }
}

internal sealed record PopularBatchResult(int Requested, int Found, int Added)
{
    public int Skipped => Found - Added;
}
