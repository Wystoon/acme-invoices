using System.Net;

namespace Acme.Invoices.Api.ExchangeRates;

/// <summary>Typed client for rates.acme.example. Created by IHttpClientFactory.</summary>
public sealed class ExchangeRateClient(HttpClient httpClient)
{
    /// <summary>Returns the rate from EUR to <paramref name="currency"/>, or null when the service does not know it.</summary>
    public async Task<decimal?> GetRateAsync(string currency, CancellationToken cancellationToken)
    {
        using var response = await httpClient.GetAsync($"rates/{currency}", cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }

        response.EnsureSuccessStatusCode();
        var payload = await response.Content.ReadFromJsonAsync<RatePayload>(cancellationToken);
        return payload?.Rate;
    }

    private sealed record RatePayload(string Base, string Currency, decimal Rate);
}
