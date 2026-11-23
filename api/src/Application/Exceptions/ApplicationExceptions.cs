namespace GamesBacklog.Application;

public enum CatalogFailure { Unavailable, MissingKey, RejectedKey, RateLimited }

public sealed class CatalogUnavailableException(CatalogFailure failure = CatalogFailure.Unavailable)
    : Exception("Game catalog unavailable.")
{
    public CatalogFailure Failure { get; } = failure;
}

public sealed class GameNotFoundException : Exception;

public sealed class DuplicateImportException : Exception;

public sealed class EmailUnavailableException : Exception
{
    public EmailUnavailableException() : base("Email service unavailable.") { }
}

public sealed class SteamUnavailableException : Exception;

public sealed class SteamAccountNotLinkedException : Exception;

public sealed class SteamGameDataPrivateException : Exception;

public sealed class SteamGameDataUnavailableException : Exception;

public sealed class ProfileNotFoundException : Exception;

public sealed class DiscordUnavailableException : Exception;

public sealed class DiscordLinkConflictException : Exception;
public sealed class DiscordOAuthNotConfiguredException : Exception;

public sealed class DealsNotConfiguredException : Exception;
public sealed class DealsUnavailableException : Exception;
