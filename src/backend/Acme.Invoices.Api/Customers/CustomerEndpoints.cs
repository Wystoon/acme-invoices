using Acme.Invoices.Domain;
using Acme.Invoices.Infrastructure;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Acme.Invoices.Api.Customers;

public static class CustomerEndpoints
{
    public static IEndpointRouteBuilder MapCustomerEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/customers", ListCustomers);
        return app;
    }

    private static async Task<Ok<List<CustomerResponse>>> ListCustomers(
        InvoicesDbContext db,
        CancellationToken cancellationToken
    )
    {
        var customers = await db
            .Customers.AsNoTracking()
            .OrderBy(customer => customer.Name)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(customers.Select(CustomerResponse.From).ToList());
    }
}

public sealed record CustomerResponse(int Id, string Name, string Email)
{
    public static CustomerResponse From(Customer customer) =>
        new(customer.Id, customer.Name, customer.Email);
}
