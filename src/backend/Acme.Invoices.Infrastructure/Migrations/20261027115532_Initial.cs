using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Acme.Invoices.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    Id = table
                        .Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 320, nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => x.Id);
                }
            );

            migrationBuilder.CreateTable(
                name: "Invoices",
                columns: table => new
                {
                    Id = table
                        .Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Number = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    CustomerId = table.Column<int>(type: "INTEGER", nullable: false),
                    IssueDate = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    DueDate = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    Currency = table.Column<string>(type: "TEXT", maxLength: 3, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Invoices_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "InvoiceLine",
                columns: table => new
                {
                    Id = table
                        .Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    InvoiceId = table.Column<int>(type: "INTEGER", nullable: false),
                    Description = table.Column<string>(
                        type: "TEXT",
                        maxLength: 200,
                        nullable: false
                    ),
                    Quantity = table.Column<decimal>(
                        type: "TEXT",
                        precision: 18,
                        scale: 4,
                        nullable: false
                    ),
                    UnitPrice = table.Column<decimal>(
                        type: "TEXT",
                        precision: 18,
                        scale: 4,
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvoiceLine", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InvoiceLine_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceLine_InvoiceId",
                table: "InvoiceLine",
                column: "InvoiceId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_CustomerId",
                table: "Invoices",
                column: "CustomerId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_Number",
                table: "Invoices",
                column: "Number",
                unique: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "InvoiceLine");

            migrationBuilder.DropTable(name: "Invoices");

            migrationBuilder.DropTable(name: "Customers");
        }
    }
}
