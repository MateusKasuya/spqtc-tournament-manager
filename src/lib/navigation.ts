import {
  LayoutDashboard,
  Trophy,
  Medal,
  Users,
  CalendarDays,
} from "lucide-react";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, adminOnly: false },
  { label: "Torneios", href: "/torneios", icon: Trophy, adminOnly: false },
  { label: "Ranking", href: "/ranking", icon: Medal, adminOnly: false },
  { label: "Jogadores", href: "/jogadores", icon: Users, adminOnly: true },
  { label: "Temporadas", href: "/temporadas", icon: CalendarDays, adminOnly: true },
];
