using Acme.LegacyHttp;

namespace Acme.Invoices.Api.Reports;

// Legacy, scheduled for removal in AB#4590
#pragma warning disable RS0030, CS0618
public sealed class LegacyReportExporter
{
    private readonly LegacyHttpClient _client = new();

    public string FetchMonthlyTemplate() =>
        _client.Get("https://reports.acme.example/templates/monthly.xml");
}
#pragma warning restore RS0030, CS0618
