using System.Net;
using System.Net.Http.Json;
using Acme.Invoices.Api.Customers;
using Acme.Invoices.Api.ExchangeRates;

namespace Acme.Invoices.Tests.Api;

public class ReferenceDataEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Customers_ReturnsAllCustomersByName()
    {
        var customers = await _client.GetFromJsonAsync<List<CustomerResponse>>(
            "/api/customers",
            Cancellation
        );

        Assert.NotNull(customers);
        Assert.Equal(8, customers.Count);
        Assert.Equal("Bluefen Bakery", customers[0].Name);
    }

    [Fact]
    public async Task ExchangeRate_ForKnownCurrency_ReturnsStubRate()
    {
        var rate = await _client.GetFromJsonAsync<ExchangeRateResponse>(
            "/api/exchange-rates/usd",
            Cancellation
        );

        Assert.Equal(new ExchangeRateResponse("EUR", "USD", 1.0850m), rate);
    }

    [Theory]
    [InlineData("XYZ", HttpStatusCode.NotFound)]
    [InlineData("US", HttpStatusCode.BadRequest)]
    public async Task ExchangeRate_ForUnknownOrInvalidCurrency_ReturnsError(
        string currency,
        HttpStatusCode expected
    )
    {
        var response = await _client.GetAsync($"/api/exchange-rates/{currency}", Cancellation);

        Assert.Equal(expected, response.StatusCode);
    }
}
