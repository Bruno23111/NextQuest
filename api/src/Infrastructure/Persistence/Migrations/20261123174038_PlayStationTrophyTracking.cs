using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GamesBacklog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlayStationTrophyTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlayStationTrophies",
                columns: table => new
                {
                    GameId = table.Column<Guid>(type: "uuid", nullable: false),
                    Bronze = table.Column<int>(type: "integer", nullable: false),
                    Silver = table.Column<int>(type: "integer", nullable: false),
                    Gold = table.Column<int>(type: "integer", nullable: false),
                    Platinum = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayStationTrophies", x => x.GameId);
                    table.ForeignKey(
                        name: "FK_PlayStationTrophies_Backlog_GameId",
                        column: x => x.GameId,
                        principalTable: "Backlog",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlayStationTrophies");
        }
    }
}
