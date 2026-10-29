namespace Acme.Invoices.Domain;

public class Customer
{
    public int Id { get; set; }

    public required string Name { get; set; }

    public required string Email { get; set; }
}
