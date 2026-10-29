using Acme.Invoices.Api.Customers;
using Acme.Invoices.Api.ExchangeRates;
using Acme.Invoices.Api.Invoices;
using Acme.Invoices.Api.Notifications;
using Acme.Invoices.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddInvoicesDatabase(
    builder.Configuration.GetConnectionString("Invoices")
        ?? throw new InvalidOperationException("ConnectionStrings:Invoices is not configured."),
    builder.Environment.ContentRootPath
);
builder.Services.AddSingleton<IEmailSender, LoggingEmailSender>();
builder.Services.AddExchangeRates(builder.Configuration);

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    await app.Services.MigrateInvoicesDatabaseAsync();
}

app.MapInvoiceEndpoints();
app.MapCustomerEndpoints();
app.MapExchangeRateEndpoints();

await app.RunAsync();
