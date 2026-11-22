import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:games_backlog/core/config/env_config.dart';
import 'package:games_backlog/core/models/api_error.dart';
import 'package:games_backlog/core/storage/session_storage.dart';

typedef SessionExpiredCallback = void Function();

class ApiClient {
  final Dio dio;
  final SessionStorage sessionStorage;
  SessionExpiredCallback? onSessionExpired;

  ApiClient({
    required this.sessionStorage,
    this.onSessionExpired,
    Dio? customDio,
  }) : dio = customDio ?? Dio() {
    _initDio();
  }

  void _initDio() {
    dio.options.baseUrl = EnvConfig.apiBaseUrl;
    dio.options.connectTimeout = const Duration(seconds: 60);
    dio.options.receiveTimeout = const Duration(seconds: 60);
    dio.options.headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // If authorization header is already set, don't overwrite
          if (!options.headers.containsKey('Authorization')) {
            final token = await sessionStorage.getAccessToken();
            final tokenType = await sessionStorage.getTokenType() ?? 'Bearer';
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = '$tokenType $token';
            }
          }
          return handler.next(options);
        },
        onError: (DioException err, handler) async {
          // Handle 401 retry with refresh token
          final is401 = err.response?.statusCode == 401;
          final isRefreshRequest = err.requestOptions.path.contains('/auth/refresh');
          final isLoginRequest = err.requestOptions.path.contains('/auth/login');

          if (is401 && !isRefreshRequest && !isLoginRequest) {
            final refreshToken = await sessionStorage.getRefreshToken();
            if (refreshToken != null && refreshToken.isNotEmpty) {
              final renewed = await _tryRefreshToken(refreshToken);
              if (renewed) {
                // Retry the original request
                final newAccessToken = await sessionStorage.getAccessToken();
                final tokenType = await sessionStorage.getTokenType() ?? 'Bearer';
                final opts = err.requestOptions;
                opts.headers['Authorization'] = '$tokenType $newAccessToken';

                try {
                  final retryResponse = await dio.fetch(opts);
                  return handler.resolve(retryResponse);
                } on DioException catch (retryErr) {
                  return handler.reject(retryErr);
                }
              } else {
                // Refresh failed; clear session and notify
                await sessionStorage.clear();
                onSessionExpired?.call();
              }
            } else {
              await sessionStorage.clear();
              onSessionExpired?.call();
            }
          }

          return handler.next(err);
        },
      ),
    );
  }

  Future<bool> _tryRefreshToken(String refreshToken) async {
    try {
      final tokenDio = Dio(
        BaseOptions(
          baseUrl: EnvConfig.apiBaseUrl,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 10),
        ),
      );

      final response = await tokenDio.post(
        '/api/v1/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        await sessionStorage.saveTokens(
          tokenType: data['tokenType'] as String? ?? 'Bearer',
          accessToken: data['accessToken'] as String,
          refreshToken: data['refreshToken'] as String,
          expiresIn: (data['expiresIn'] as num?)?.toInt() ?? 900,
        );
        return true;
      }
    } catch (_) {
      // Refresh failed
    }
    return false;
  }

  /// Helper to convert DioException or raw exceptions to AppApiException
  static AppApiException handleException(dynamic error) {
    if (error is AppApiException) return error;

    if (error is DioException) {
      final status = error.response?.statusCode;
      final data = error.response?.data;

      ProblemDetails? problem;
      if (data is Map<String, dynamic>) {
        problem = ProblemDetails.fromJson(data);
      } else if (data is String && data.isNotEmpty) {
        try {
          final decoded = jsonDecode(data);
          if (decoded is Map<String, dynamic>) {
            problem = ProblemDetails.fromJson(decoded);
          }
        } catch (_) {
          // not json
        }
      }

      if (problem != null) {
        return AppApiException(
          problem.displayMessage,
          statusCode: status,
          problem: problem,
        );
      }

      if (status == 401) {
        return const AppApiException('Credenciais inválidas ou conta indisponível.', statusCode: 401);
      } else if (status == 404) {
        return const AppApiException('Recurso não encontrado.', statusCode: 404);
      } else if (status == 409) {
        return const AppApiException('Jogo já importado para esta plataforma.', statusCode: 409);
      } else if (status == 503) {
        return const AppApiException('Serviço temporariamente indisponível. Tente novamente.', statusCode: 503);
      } else if (status == 429) {
        return const AppApiException('Muitas requisições. Aguarde um instante e tente novamente.', statusCode: 429);
      }

      return AppApiException(
        error.message ?? 'Falha de comunicação com o servidor.',
        statusCode: status,
      );
    }

    return AppApiException(error.toString());
  }
}
