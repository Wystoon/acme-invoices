using Acme.Invoices.Domain;
using Microsoft.EntityFrameworkCore;

namespace Acme.Invoices.Infrastructure;

public class InvoicesDbContext(DbContextOptions<InvoicesDbContext> options) : DbContext(options)
{
    public DbSet<Customer> Customers => Set<Customer>();

    public DbSet<Invoice> Invoices => Set<Invoice>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Customer>(customer =>
        {
            customer.Property(c => c.Name).HasMaxLength(200);
            customer.Property(c => c.Email).HasMaxLength(320);
        });

        modelBuilder.Entity<Invoice>(invoice =>
        {
            invoice.Property(i => i.Number).HasMaxLength(20);
            invoice.HasIndex(i => i.Number).IsUnique();
            invoice.Property(i => i.Currency).HasMaxLength(3);
            invoice.Property(i => i.Status).HasConversion<string>().HasMaxLength(20);
            invoice.HasOne(i => i.Customer).WithMany().HasForeignKey(i => i.CustomerId);
            invoice.HasMany(i => i.Lines).WithOne().HasForeignKey(l => l.InvoiceId);
        });

        modelBuilder.Entity<InvoiceLine>(line =>
        {
            line.Property(l => l.Description).HasMaxLength(200);
            line.Property(l => l.Quantity).HasPrecision(18, 4);
            line.Property(l => l.UnitPrice).HasPrecision(18, 4);
        });
    }
}
