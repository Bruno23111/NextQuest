FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source
COPY api/Directory.Build.props api/
COPY api/src/ api/src/
RUN dotnet publish api/src/Api/GamesBacklog.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/ ./
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "GamesBacklog.Api.dll"]
