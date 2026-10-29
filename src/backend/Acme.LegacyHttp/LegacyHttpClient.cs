namespace Acme.LegacyHttp;

/// <summary>
/// Synchronous HTTP helper from the first version of the invoicing system.
/// Creates a new connection per call and blocks the calling thread.
/// </summary>
[Obsolete("Acme.LegacyHttp is deprecated. Use IHttpClientFactory. Removal is tracked in AB#4590.")]
public sealed class LegacyHttpClient
{
    public string Get(string url)
    {
        using var client = new HttpClient();
        using var response = client.Send(new HttpRequestMessage(HttpMethod.Get, url));
        response.EnsureSuccessStatusCode();
        using var reader = new StreamReader(response.Content.ReadAsStream());
        return reader.ReadToEnd();
    }
}
