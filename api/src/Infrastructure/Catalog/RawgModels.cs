using System.Text.Json.Serialization;

namespace GamesBacklog.Infrastructure.Catalog;

internal sealed record RawgPage([property: JsonRequired] RawgGame?[]? Results, string? Next);

internal sealed record RawgGame(
    int Id,
    string? Name,
    [property: JsonPropertyName("background_image")] string? BackgroundImage,
    RawgPlatformReference?[]? Platforms);

internal sealed record RawgPlatformReference(RawgPlatform? Platform);

internal sealed record RawgPlatform(int Id, string? Name);
