using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GamesBacklog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FriendsAndWishlist : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Friendships",
                columns: table => new
                {
                    FirstId = table.Column<Guid>(type: "uuid", nullable: false),
                    SecondId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    Accepted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Friendships", x => new { x.FirstId, x.SecondId });
                    table.ForeignKey(
                        name: "FK_Friendships_Users_FirstId",
                        column: x => x.FirstId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Friendships_Users_SecondId",
                        column: x => x.SecondId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Wishes",
                columns: table => new
                {
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    GameId = table.Column<int>(type: "integer", nullable: false),
                    AddedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Wishes", x => new { x.OwnerId, x.GameId });
                    table.ForeignKey(
                        name: "FK_Wishes_CatalogEntries_GameId",
                        column: x => x.GameId,
                        principalTable: "CatalogEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Wishes_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Friendships_SecondId",
                table: "Friendships",
                column: "SecondId");

            migrationBuilder.CreateIndex(
                name: "IX_Wishes_GameId",
                table: "Wishes",
                column: "GameId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Friendships");

            migrationBuilder.DropTable(
                name: "Wishes");
        }
    }
}
