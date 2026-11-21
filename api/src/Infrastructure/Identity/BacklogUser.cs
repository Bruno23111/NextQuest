using Microsoft.AspNetCore.Identity;

namespace GamesBacklog.Infrastructure.Identity;

public sealed class BacklogUser : IdentityUser<Guid>
{
    public BacklogUser() => Id = Guid.NewGuid();
}
