using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GamesBacklog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SteamLogin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "NormalizedEmail",
                table: "Users",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(256)",
                oldMaxLength: 256);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Users",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(256)",
                oldMaxLength: 256);

            migrationBuilder.AddColumn<string>(
                name: "SteamId",
                table: "Users",
                type: "character varying(17)",
                maxLength: 17,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SteamLoginFlows",
                columns: table => new
                {
                    State = table.Column<string>(type: "character varying(43)", maxLength: 43, nullable: false),
                    Challenge = table.Column<string>(type: "character varying(43)", maxLength: 43, nullable: false),
                    ExpiresAt = table.Column<long>(type: "bigint", nullable: false),
                    LinkOwnerId = table.Column<Guid>(type: "uuid", nullable: true),
                    Nonce = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    SteamId = table.Column<string>(type: "character varying(17)", maxLength: 17, nullable: true),
                    CodeHash = table.Column<string>(type: "character varying(43)", maxLength: 43, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SteamLoginFlows", x => x.State);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_SteamId",
                table: "Users",
                column: "SteamId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SteamLoginFlows_ExpiresAt",
                table: "SteamLoginFlows",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_SteamLoginFlows_Nonce",
                table: "SteamLoginFlows",
                column: "Nonce",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM "Users" WHERE "Email" IS NULL OR "NormalizedEmail" IS NULL) THEN
                        RAISE EXCEPTION 'Cannot roll back Steam login while accounts without email exist.';
                    END IF;
                END $$;
                """);

            migrationBuilder.DropTable(
                name: "SteamLoginFlows");

            migrationBuilder.DropIndex(
                name: "IX_Users_SteamId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SteamId",
                table: "Users");

            migrationBuilder.AlterColumn<string>(
                name: "NormalizedEmail",
                table: "Users",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(256)",
                oldMaxLength: 256,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Users",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(256)",
                oldMaxLength: 256,
                oldNullable: true);
        }
    }
}
