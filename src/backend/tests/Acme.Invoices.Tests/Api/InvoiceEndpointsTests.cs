using System.Net;
using System.Net.Http.Json;
using Acme.Invoices.Api;
using Acme.Invoices.Api.Invoices;

namespace Acme.Invoices.Tests.Api;

public class InvoiceEndpointsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    [Fact]
    public async Task List_WithoutParameters_ReturnsFirstPageNewestFirst()
    {
        var page = await GetPageAsync("/api/invoices");

        Assert.Equal(40, page.TotalCount);
        Assert.Equal(InvoiceEndpoints.DefaultPageSize, page.Items.Count);
        Assert.Equal("INV-2026-0040", page.Items[0].Number);
    }

    [Fact]
    public async Task List_SecondPage_EndsWithOldestInvoice()
    {
        var page = await GetPageAsync("/api/invoices?page=2&pageSize=20");

        Assert.Equal(2, page.Page);
        Assert.Equal(20, page.Items.Count);
        Assert.Equal("INV-2026-0001", page.Items[^1].Number);
    }

    [Fact]
    public async Task List_FilteredByStatus_ReturnsOnlyThatStatus()
    {
        var page = await GetPageAsync("/api/invoices?status=overdue");

        Assert.Equal(4, page.TotalCount);
        Assert.All(page.Items, invoice => Assert.Equal("Overdue", invoice.Status));
        Assert.All(page.Items, invoice => Assert.True(invoice.DaysOverdue > 0));
    }

    [Fact]
    public async Task List_FilteredByCustomer_ReturnsOnlyThatCustomer()
    {
        var page = await GetPageAsync("/api/invoices?customerId=3");

        Assert.Equal(5, page.TotalCount);
        Assert.All(page.Items, invoice => Assert.Equal("Dunmere Dental", invoice.CustomerName));
    }

    [Theory]
    [InlineData("/api/invoices?pageSize=0")]
    [InlineData("/api/invoices?pageSize=101")]
    [InlineData("/api/invoices?page=0")]
    [InlineData("/api/invoices?status=Unpaid")]
    public async Task List_WithInvalidParameters_ReturnsValidationProblem(string url)
    {
        var response = await _client.GetAsync(url, Cancellation);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Get_ExistingInvoice_ReturnsCustomerAndLines()
    {
        var invoice = await _client.GetFromJsonAsync<InvoiceDetailResponse>(
            "/api/invoices/1",
            Cancellation
        );

        Assert.NotNull(invoice);
        Assert.Equal("INV-2026-0001", invoice.Number);
        Assert.Equal("Bluefen Bakery", invoice.Customer?.Name);
        var line = Assert.Single(invoice.Lines);
        Assert.Equal(690.00m, line.Total);
        Assert.Equal(690.00m, invoice.Total);
    }

    [Fact]
    public async Task Get_UnknownInvoice_ReturnsNotFound()
    {
        var response = await _client.GetAsync("/api/invoices/9999", Cancellation);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SendReminder_ForOverdueInvoice_EmailsTheCustomer()
    {
        var response = await _client.PostAsync("/api/invoices/5/send-reminder", null, Cancellation);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Contains(
            factory.Emails.Sent,
            email =>
                email.To == "ap@fallowmere.example"
                && email.Subject == "Reminder: invoice INV-2026-0005"
        );
    }

    [Fact]
    public async Task SendReminder_ForPaidInvoice_ReturnsConflict()
    {
        var response = await _client.PostAsync("/api/invoices/1/send-reminder", null, Cancellation);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    private async Task<PagedResponse<InvoiceSummaryResponse>> GetPageAsync(string url)
    {
        var page = await _client.GetFromJsonAsync<PagedResponse<InvoiceSummaryResponse>>(
            url,
            Cancellation
        );
        Assert.NotNull(page);
        return page;
    }
}
