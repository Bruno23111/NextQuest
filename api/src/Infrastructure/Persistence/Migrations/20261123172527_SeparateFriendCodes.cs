using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GamesBacklog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SeparateFriendCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FriendCode",
                table: "Users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValueSql: "substr(replace(gen_random_uuid()::text, '-', ''), 13, 20)");

            migrationBuilder.CreateIndex(
                name: "IX_Users_FriendCode",
                table: "Users",
                column: "FriendCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_FriendCode",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "FriendCode",
                table: "Users");
        }
    }
}
