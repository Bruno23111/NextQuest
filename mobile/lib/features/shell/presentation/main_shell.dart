import 'package:flutter/material.dart';
import 'package:games_backlog/core/constants/app_colors.dart';
import 'package:games_backlog/core/constants/app_strings.dart';
import 'package:games_backlog/features/shell/presentation/widgets/psn_bottom_nav_bar.dart';
import 'package:go_router/go_router.dart';

class MainShell extends StatelessWidget {
  final StatefulNavigationShell navigationShell;

  const MainShell({super.key, required this.navigationShell});

  static const List<PsnNavItem> _navItems = [
    PsnNavItem(
      label: AppStrings.library,
      icon: Icons.grid_view_outlined,
      selectedIcon: Icons.grid_view_rounded,
    ),
    PsnNavItem(
      label: AppStrings.search,
      icon: Icons.search_rounded,
      selectedIcon: Icons.search_rounded,
    ),
    PsnNavItem(
      label: AppStrings.account,
      icon: Icons.person_outline_rounded,
      selectedIcon: Icons.person_rounded,
    ),
  ];

  void _onDestinationSelected(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWideScreen = constraints.maxWidth >= 720;

        if (isWideScreen) {
          // Desktop / Wide NavigationRail
          return Scaffold(
            body: Row(
              children: [
                NavigationRail(
                  selectedIndex: navigationShell.currentIndex,
                  onDestinationSelected: _onDestinationSelected,
                  labelType: NavigationRailLabelType.all,
                  backgroundColor: const Color(0xFF11151C),
                  leading: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [AppColors.tealLight, AppColors.cyanAccent],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.cyanAccent.withValues(alpha: 0.3),
                            blurRadius: 10,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.sports_esports_rounded,
                        color: Colors.black,
                        size: 26,
                      ),
                    ),
                  ),
                  destinations: _navItems
                      .map(
                        (item) => NavigationRailDestination(
                          icon: Icon(item.icon),
                          selectedIcon: Icon(item.selectedIcon),
                          label: Text(item.label),
                        ),
                      )
                      .toList(),
                ),
                const VerticalDivider(thickness: 1, width: 1, color: AppColors.border),
                Expanded(child: navigationShell),
              ],
            ),
          );
        }

        // Mobile / Small Screen PSN-inspired Bottom Navigation Bar
        return Scaffold(
          body: navigationShell,
          bottomNavigationBar: PsnBottomNavBar(
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: _onDestinationSelected,
            items: _navItems,
          ),
        );
      },
    );
  }
}
