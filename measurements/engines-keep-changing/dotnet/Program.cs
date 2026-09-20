// The test card through the .NET engine (NuGet Spintax.Core): dotnet run -- ../card.json
// Prints one line per case: its id and the share of renders that come out right (as measure.mjs scores it).
using System.Text.Json;
using System.Text.RegularExpressions;
using Spintax.Core;

const int Seeds = 100;
var card = JsonDocument.Parse(File.ReadAllText(args.Length > 0 ? args[0] : "../card.json")).RootElement.GetProperty("cases");
Console.OutputEncoding = System.Text.Encoding.UTF8;
Console.WriteLine("Spintax.Core " + typeof(Engine).Assembly.GetName().Version);
foreach (var c in card.EnumerateArray())
{
    var ctx = new Dictionary<string, string>();
    if (c.TryGetProperty("context", out var cx)) foreach (var p in cx.EnumerateObject()) ctx[p.Name] = p.Value.GetString()!;
    string Render(int seed) => Engine.Render(c.GetProperty("src").GetString()!, new RenderOptions { Context = ctx, Seed = seed.ToString() });
    double score;
    if (c.TryGetProperty("expect", out var expect)) score = Render(1) == expect.GetString() ? 1 : 0;
    else
    {
        var shape = new Regex(c.GetProperty("shape").GetString()!);
        // A permutation shuffles distinct elements, which no regex alternation can say.
        bool Distinct(string outText)
        {
            var items = Regex.Split(Regex.Replace(outText, @"^[^:]*:\s*", "").TrimEnd('.'), @",\s*|\s+and\s+");
            return items.Distinct().Count() == items.Length;
        }
        score = Enumerable.Range(1, Seeds).Count(s => { var o = Render(s); return shape.IsMatch(o) && Distinct(o); }) / (double)Seeds;
    }
    Console.WriteLine($"{c.GetProperty("id").GetString(),-26}{score.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture)}  {JsonSerializer.Serialize(Render(1), new JsonSerializerOptions { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping })}");
}
