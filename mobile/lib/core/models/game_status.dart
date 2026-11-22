import 'package:flutter/material.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/core/constants/app_strings.dart';

enum GameStatus {
  planned,
  playing,
  completed,
  dropped;

  String toApiValue() => name;

  static GameStatus fromApiValue(String? value) {
    switch (value) {
      case 'playing':
        return GameStatus.playing;
      case 'completed':
        return GameStatus.completed;
      case 'dropped':
        return GameStatus.dropped;
      case 'planned':
      default:
        return GameStatus.planned;
    }
  }

  String get label {
    switch (this) {
      case GameStatus.planned:
        return AppStrings.statusPlanned;
      case GameStatus.playing:
        return AppStrings.statusPlaying;
      case GameStatus.completed:
        return AppStrings.statusCompleted;
      case GameStatus.dropped:
        return AppStrings.statusDropped;
    }
  }

  Color get color {
    switch (this) {
      case GameStatus.planned:
        return AppColors.statusPlanned;
      case GameStatus.playing:
        return AppColors.statusPlaying;
      case GameStatus.completed:
        return AppColors.statusCompleted;
      case GameStatus.dropped:
        return AppColors.statusDropped;
    }
  }

  IconData get icon {
    switch (this) {
      case GameStatus.planned:
        return Icons.bookmark_border_rounded;
      case GameStatus.playing:
        return Icons.play_arrow_rounded;
      case GameStatus.completed:
        return Icons.check_circle_outline_rounded;
      case GameStatus.dropped:
        return Icons.cancel_outlined;
    }
  }
}
