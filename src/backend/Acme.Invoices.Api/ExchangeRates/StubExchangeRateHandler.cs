using System.Net;

namespace Acme.Invoices.Api.ExchangeRates;

/// <summary>
/// Stands in for rates.acme.example during development and tests: fixed EUR-based rates, no network.
/// </summary>
public sealed class StubExchangeRateHandler : HttpMessageHandler
{
    private static readonly Dictionary<string, decimal> Rates = new(StringComparer.Ordinal)
    {
        ["CHF"] = 0.9375m,
        ["EUR"] = 1.0000m,
        ["GBP"] = 0.8420m,
        ["SEK"] = 11.4210m,
        ["USD"] = 1.0850m,
    };

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken
    )
    {
        var currency = request.RequestUri?.Segments.LastOrDefault() ?? string.Empty;
        var response = Rates.TryGetValue(currency, out var rate)
            ? new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(
                    new
                    {
                        @base = ExchangeRateEndpoints.BaseCurrency,
                        currency,
                        rate,
                    }
                ),
            }
            : new HttpResponseMessage(HttpStatusCode.NotFound);
        return Task.FromResult(response);
    }
}
