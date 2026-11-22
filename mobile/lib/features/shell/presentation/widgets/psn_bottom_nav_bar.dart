import 'package:flutter/material.dart';
import 'package:games_backlog/core/constants/app_colors.dart';

class PsnNavItem {
  final String label;
  final IconData icon;
  final IconData selectedIcon;

  const PsnNavItem({
    required this.label,
    required this.icon,
    required this.selectedIcon,
  });
}

class PsnBottomNavBar extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final List<PsnNavItem> items;

  const PsnBottomNavBar({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.paddingOf(context).bottom;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF11151C),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
        border: Border(
          top: BorderSide(
            color: Colors.white.withValues(alpha: 0.08),
            width: 1,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      padding: EdgeInsets.only(bottom: bottomPadding),
      child: SizedBox(
        height: 74,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Icons Row with PSN-style radial glow beneath active icon
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final itemWidth = constraints.maxWidth / items.length;

                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      // Animated glowing spotlight under the selected icon
                      AnimatedPositioned(
                        duration: const Duration(milliseconds: 240),
                        curve: Curves.easeOutCubic,
                        left: (itemWidth * selectedIndex) + (itemWidth / 2) - 42,
                        top: 4,
                        bottom: 0,
                        width: 84,
                        child: IgnorePointer(
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: RadialGradient(
                                center: const Alignment(0, 0.35),
                                radius: 0.75,
                                colors: [
                                  AppColors.cyanAccent.withValues(alpha: 0.38),
                                  AppColors.tealPrimary.withValues(alpha: 0.18),
                                  Colors.transparent,
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                      // Subtle curved/pill highlight under the selected icon
                      AnimatedPositioned(
                        duration: const Duration(milliseconds: 240),
                        curve: Curves.easeOutCubic,
                        left: (itemWidth * selectedIndex) + (itemWidth / 2) - 16,
                        bottom: 4,
                        width: 32,
                        height: 3,
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(2),
                            color: AppColors.cyanAccent,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.cyanAccent.withValues(alpha: 0.7),
                                blurRadius: 8,
                              ),
                            ],
                          ),
                        ),
                      ),
                      // Icon buttons
                      Row(
                        children: List.generate(items.length, (index) {
                          final item = items[index];
                          final isSelected = index == selectedIndex;

                          return Expanded(
                            child: Semantics(
                              label: item.label,
                              selected: isSelected,
                              button: true,
                              child: InkWell(
                                onTap: () => onDestinationSelected(index),
                                borderRadius: BorderRadius.circular(16),
                                splashColor: AppColors.cyanAccent.withValues(alpha: 0.12),
                                highlightColor: Colors.transparent,
                                child: Center(
                                  child: AnimatedScale(
                                    scale: isSelected ? 1.1 : 1.0,
                                    duration: const Duration(milliseconds: 200),
                                    child: Icon(
                                      isSelected ? item.selectedIcon : item.icon,
                                      size: 26,
                                      color: isSelected
                                          ? Colors.white
                                          : Colors.white.withValues(alpha: 0.55),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                    ],
                  );
                },
              ),
            ),
            // Centered single label of the active tab at the bottom (PSN App style)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                child: Text(
                  items[selectedIndex].label,
                  key: ValueKey(items[selectedIndex].label),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.2,
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
