using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GamesBacklog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlayStationSync : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PsnTrophyId",
                table: "Backlog",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Backlog_OwnerId_PsnTrophyId",
                table: "Backlog",
                columns: new[] { "OwnerId", "PsnTrophyId" },
                unique: true,
                filter: "\"PsnTrophyId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Backlog_OwnerId_PsnTrophyId",
                table: "Backlog");

            migrationBuilder.DropColumn(
                name: "PsnTrophyId",
                table: "Backlog");
        }
    }
}
