var builder = WebApplication.CreateBuilder(args);
builder.Services.AddReverseProxy().LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));
builder.Services.AddHttpClient("ServiceDocumentation", client => client.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"]).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
var app = builder.Build();
app.UseCors();
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "Gateway" }));
if (app.Environment.IsDevelopment())
{
    var services = new[] { "IAM", "HR", "Attendance", "Payroll", "Compliance", "Notification" };
    app.UseSwaggerUI(options => {
        options.DocumentTitle = "VNC HRMS APIs";
        foreach (var service in services) options.SwaggerEndpoint($"/swagger/services/{service}/swagger.json", service);
        options.UseRequestInterceptor("function(request) { request.credentials = 'include'; if (request.method === 'POST' && !request.body) { request.headers['Content-Type'] = 'application/json'; request.body = '{}'; } return request; }");
    });
    app.MapGet("/swagger/services/{service}/swagger.json", async (string service, IHttpClientFactory clients, HttpContext context) => {
        if (!services.Contains(service, StringComparer.Ordinal)) return Results.NotFound();
        var address = app.Configuration[$"ReverseProxy:Clusters:{service}:Destinations:primary:Address"];
        if (!Uri.TryCreate(address, UriKind.Absolute, out var baseAddress)) return Results.StatusCode(503);
        try
        {
            using var response = await clients.CreateClient("ServiceDocumentation").GetAsync(new Uri(baseAddress, "swagger/v1/swagger.json"), context.RequestAborted);
            if (!response.IsSuccessStatusCode) return Results.StatusCode(503);
            return Results.Content(await response.Content.ReadAsStringAsync(context.RequestAborted), "application/json");
        }
        catch (HttpRequestException) { return Results.StatusCode(503); }
        catch (OperationCanceledException) when (!context.RequestAborted.IsCancellationRequested) { return Results.StatusCode(503); }
    });
    app.MapGet("/", () => Results.Redirect("/swagger"));
}
app.MapReverseProxy();
app.Run();
