using Microsoft.AspNetCore.Http.HttpResults;

namespace Acme.Invoices.Api.ExchangeRates;

public static class ExchangeRateEndpoints
{
    public const string BaseCurrency = "EUR";

    public static IServiceCollection AddExchangeRates(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        var settings = configuration.GetSection("ExchangeRates");
        var baseUrl =
            settings["BaseUrl"]
            ?? throw new InvalidOperationException("ExchangeRates:BaseUrl is not configured.");
        var client = services.AddHttpClient<ExchangeRateClient>(http =>
            http.BaseAddress = new Uri(baseUrl)
        );
        if (settings.GetValue<bool>("UseStub"))
        {
            client.ConfigurePrimaryHttpMessageHandler(() => new StubExchangeRateHandler());
        }

        return services;
    }

    public static IEndpointRouteBuilder MapExchangeRateEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/exchange-rates/{currency}", GetRate);
        return app;
    }

    private static async Task<
        Results<Ok<ExchangeRateResponse>, NotFound, ValidationProblem>
    > GetRate(string currency, ExchangeRateClient client, CancellationToken cancellationToken)
    {
        if (currency.Length != 3 || !currency.All(char.IsAsciiLetter))
        {
            return TypedResults.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["currency"] = ["Use a three-letter ISO 4217 code, for example USD."],
                }
            );
        }

        var code = currency.ToUpperInvariant();
        var rate = await client.GetRateAsync(code, cancellationToken);
        return rate is { } value
            ? TypedResults.Ok(new ExchangeRateResponse(BaseCurrency, code, value))
            : TypedResults.NotFound();
    }
}

public sealed record ExchangeRateResponse(string Base, string Currency, decimal Rate);
