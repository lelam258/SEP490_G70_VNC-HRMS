using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpiredDependentDocumentStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_dependent_documents_status",
                schema: "dbo",
                table: "dependent_documents");

            migrationBuilder.AddCheckConstraint(
                name: "CK_dependent_documents_status",
                schema: "dbo",
                table: "dependent_documents",
                sql: "[verification_status] IN ('pending', 'verified', 'rejected', 'expired')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_dependent_documents_status",
                schema: "dbo",
                table: "dependent_documents");

            migrationBuilder.AddCheckConstraint(
                name: "CK_dependent_documents_status",
                schema: "dbo",
                table: "dependent_documents",
                sql: "[verification_status] IN ('pending', 'verified', 'rejected')");
        }
    }
}
