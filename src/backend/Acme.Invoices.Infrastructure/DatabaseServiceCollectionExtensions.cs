using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Acme.Invoices.Infrastructure;

public static class DatabaseServiceCollectionExtensions
{
    /// <summary>
    /// Registers the SQLite database. A relative file path in the connection string is resolved
    /// against <paramref name="contentRootPath"/>, so the database file does not depend on the shell's directory.
    /// </summary>
    public static IServiceCollection AddInvoicesDatabase(
        this IServiceCollection services,
        string connectionString,
        string contentRootPath
    )
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);
        if (builder.Mode != SqliteOpenMode.Memory && !Path.IsPathRooted(builder.DataSource))
        {
            builder.DataSource = Path.Combine(contentRootPath, builder.DataSource);
        }

        return services.AddDbContext<InvoicesDbContext>(options =>
            options
                .UseSqlite(builder.ConnectionString)
                .UseSeeding(
                    (context, _) =>
                    {
                        if (SeedData.AddTo((InvoicesDbContext)context))
                        {
                            context.SaveChanges();
                        }
                    }
                )
                .UseAsyncSeeding(
                    async (context, _, cancellationToken) =>
                    {
                        if (SeedData.AddTo((InvoicesDbContext)context))
                        {
                            await context.SaveChangesAsync(cancellationToken);
                        }
                    }
                )
        );
    }

    /// <summary>Applies pending migrations, then seeds an empty database.</summary>
    public static async Task MigrateInvoicesDatabaseAsync(this IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<InvoicesDbContext>();
        await db.Database.MigrateAsync();
    }
}
