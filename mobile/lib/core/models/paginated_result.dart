class PaginatedResult<T> {
  final List<T> items;
  final int page;
  final int pageSize;
  final bool hasMore;

  const PaginatedResult({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.hasMore,
  });

  factory PaginatedResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) itemMapper,
  ) {
    final rawList = json['items'] as List<dynamic>? ?? [];
    final items = rawList
        .whereType<Map<String, dynamic>>()
        .map(itemMapper)
        .toList();

    return PaginatedResult(
      items: items,
      page: json['page'] as int? ?? 1,
      pageSize: json['pageSize'] as int? ?? 20,
      hasMore: json['hasMore'] as bool? ?? false,
    );
  }

  PaginatedResult<T> copyWith({
    List<T>? items,
    int? page,
    int? pageSize,
    bool? hasMore,
  }) {
    return PaginatedResult(
      items: items ?? this.items,
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      hasMore: hasMore ?? this.hasMore,
    );
  }
}
