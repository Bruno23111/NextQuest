class EnvConfig {
  EnvConfig._();

  /// Whether the app is running in offline demonstration mode.
  /// Activated with `--dart-define=USE_MOCK_API=true`.
  static const bool useMockApi = bool.fromEnvironment(
    'USE_MOCK_API',
    defaultValue: false,
  );

  /// API Base URL. Default is http://127.0.0.1:5080 (or http://10.0.2.2:5080 on Android emulator).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:5080',
  );
}
