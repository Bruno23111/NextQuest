using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GamesBacklog.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PlayQueueAndJournal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid[]>(
                name: "PlayQueue",
                table: "Users",
                type: "uuid[]",
                nullable: false,
                defaultValue: new Guid[0]);

            migrationBuilder.AddColumn<string>(
                name: "LastCheckpoint",
                table: "Backlog",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NextObjective",
                table: "Backlog",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Backlog",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PlayQueue",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastCheckpoint",
                table: "Backlog");

            migrationBuilder.DropColumn(
                name: "NextObjective",
                table: "Backlog");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Backlog");
        }
    }
}
