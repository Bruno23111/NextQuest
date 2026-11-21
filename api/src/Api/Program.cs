using GamesBacklog.Api;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var migrate = args is ["--migrate"];
var app = ApiHost.Build(new WebApplicationOptions { Args = migrate ? [] : args });
if (migrate)
{
    await using (var scope = app.Services.CreateAsyncScope())
        await scope.ServiceProvider.GetRequiredService<BacklogDbContext>().Database.MigrateAsync();
    await app.DisposeAsync();
    return;
}

await app.RunAsync();
