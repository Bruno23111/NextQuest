using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GamesBacklog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CatalogFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "NewRelease",
                table: "CatalogEntries",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "Popular",
                table: "CatalogEntries",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NewRelease",
                table: "CatalogEntries");

            migrationBuilder.DropColumn(
                name: "Popular",
                table: "CatalogEntries");
        }
    }
}
