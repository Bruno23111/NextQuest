import 'package:flutter/material.dart';

class NextQuestLogo extends StatelessWidget {
  const NextQuestLogo({super.key, required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * .22),
      child: Image.asset(
        'assets/brand/nextquest.png',
        width: size,
        height: size,
        fit: BoxFit.cover,
        excludeFromSemantics: true,
      ),
    );
  }
}
