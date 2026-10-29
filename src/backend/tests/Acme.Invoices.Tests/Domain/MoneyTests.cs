using System.Globalization;
using Acme.Invoices.Domain;

namespace Acme.Invoices.Tests.Domain;

public class MoneyTests
{
    [Theory]
    [InlineData("1.005", "1.01")]
    [InlineData("2.345", "2.35")]
    [InlineData("-1.005", "-1.01")]
    [InlineData("1.004", "1.00")]
    [InlineData("19.999", "20.00")]
    public void Round_RoundsMidpointsAwayFromZero(string amount, string expected)
    {
        Assert.Equal(
            decimal.Parse(expected, CultureInfo.InvariantCulture),
            Money.Round(decimal.Parse(amount, CultureInfo.InvariantCulture))
        );
    }
}
