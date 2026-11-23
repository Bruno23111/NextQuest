using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GamesBacklog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CuratedGameVideos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GameVideos",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Channel = table.Column<string>(type: "text", nullable: false),
                    ThumbnailUrl = table.Column<string>(type: "text", nullable: true),
                    CanPlayHere = table.Column<bool>(type: "boolean", nullable: false),
                    Category = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    RawgId = table.Column<int>(type: "integer", nullable: true),
                    PublishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CheckedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameVideos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GameVideos_CatalogEntries_RawgId",
                        column: x => x.RawgId,
                        principalTable: "CatalogEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GameVideos_CheckedAt",
                table: "GameVideos",
                column: "CheckedAt");

            migrationBuilder.CreateIndex(
                name: "IX_GameVideos_PublishedAt",
                table: "GameVideos",
                column: "PublishedAt");

            migrationBuilder.CreateIndex(
                name: "IX_GameVideos_RawgId",
                table: "GameVideos",
                column: "RawgId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GameVideos");
        }
    }
}
