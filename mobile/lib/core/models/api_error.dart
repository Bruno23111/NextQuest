class ProblemDetails {
  final String? type;
  final String? title;
  final int? status;
  final String? detail;
  final String? instance;
  final Map<String, List<String>>? errors;

  const ProblemDetails({
    this.type,
    this.title,
    this.status,
    this.detail,
    this.instance,
    this.errors,
  });

  factory ProblemDetails.fromJson(Map<String, dynamic> json) {
    Map<String, List<String>>? validationErrors;
    if (json['errors'] is Map) {
      final rawErrors = json['errors'] as Map;
      validationErrors = rawErrors.map((key, value) {
        if (value is List) {
          return MapEntry(key.toString(), value.map((e) => e.toString()).toList());
        }
        return MapEntry(key.toString(), [value.toString()]);
      });
    }

    return ProblemDetails(
      type: json['type'] as String?,
      title: json['title'] as String?,
      status: json['status'] is int ? json['status'] as int : int.tryParse(json['status']?.toString() ?? ''),
      detail: json['detail'] as String?,
      instance: json['instance'] as String?,
      errors: validationErrors,
    );
  }

  String get displayMessage {
    if (detail != null && detail!.trim().isNotEmpty) {
      return detail!;
    }
    if (errors != null && errors!.isNotEmpty) {
      final firstKey = errors!.keys.first;
      final firstMsg = errors![firstKey]?.firstOrNull;
      if (firstMsg != null && firstMsg.isNotEmpty) {
        return firstMsg;
      }
    }
    if (title != null && title!.trim().isNotEmpty) {
      return title!;
    }
    return 'Ocorreu um erro inesperado.';
  }
}

class AppApiException implements Exception {
  final String message;
  final int? statusCode;
  final ProblemDetails? problem;

  const AppApiException(this.message, {this.statusCode, this.problem});

  bool get isUnauthorized => statusCode == 401;
  bool get isConflict => statusCode == 409;
  bool get isUnavailable => statusCode == 503;
  bool get isNotFound => statusCode == 404;

  @override
  String toString() => message;
}
