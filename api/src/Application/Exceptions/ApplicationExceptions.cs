namespace GamesBacklog.Application;

public sealed class CatalogUnavailableException : Exception
{
    public CatalogUnavailableException() : base("Game catalog unavailable.") { }
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
