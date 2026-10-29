namespace Acme.Invoices.Api;

public static class TimeProviderExtensions
{
    /// <summary>Today's date in UTC. Invoice dates have no time zone.</summary>
    public static DateOnly Today(this TimeProvider clock) =>
        DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
}
