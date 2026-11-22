using FluentValidation;

namespace GamesBacklog.Api.Endpoints;

internal static class ProfileImageUpload
{
    private const int MaxBytes = 8 * 1024 * 1024;

    internal static async Task<string?> Read(IFormFile? file, string field, CancellationToken ct)
    {
        if (file is null) return null;

        if (file.Length is < 12 or > MaxBytes)
            throw new ValidationException([new(field, "Envie uma imagem de até 8 MB.")]);

        var bytes = new byte[(int)file.Length];
        await using var stream = file.OpenReadStream();
        await stream.ReadExactlyAsync(bytes, ct);

        var mime = GetMimeType(bytes);
        if (mime is null)
            throw new ValidationException([new(field, "Envie uma imagem PNG, JPEG ou WebP.")]);

        return $"data:{mime};base64,{Convert.ToBase64String(bytes)}";
    }

    private static string? GetMimeType(ReadOnlySpan<byte> bytes)
    {
        if (bytes.StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
            return "image/png";
        if (bytes.StartsWith(new byte[] { 255, 216, 255 }))
            return "image/jpeg";
        if (bytes.StartsWith("RIFF"u8) && bytes[8..12].SequenceEqual("WEBP"u8))
            return "image/webp";
        return null;
    }
}
