using System.Text.RegularExpressions;

namespace Vnc.HRMS.Common.Utils;

public static class UsernamePolicy
{
    public static bool IsValid(string? value)
    {
        var name = value?.Trim();
        return name is { Length: >= 3 and <= 50 } && Regex.IsMatch(name,
            @"\A(?:[a-zA-Z0-9._-]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\z");
    }
}
