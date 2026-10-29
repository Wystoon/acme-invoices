namespace Acme.Invoices.Domain;

public static class Money
{
    public const int Decimals = 2;

    /// <summary>Rounds an amount to cents, with midpoints away from zero (1.005 becomes 1.01).</summary>
    public static decimal Round(decimal amount) =>
        Math.Round(amount, Decimals, MidpointRounding.AwayFromZero);
}
