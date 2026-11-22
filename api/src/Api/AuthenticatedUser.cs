using System.Security.Claims;

namespace GamesBacklog.Api;

internal static class AuthenticatedUser
{
    internal static Guid GetOwnerId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
