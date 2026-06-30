import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart2,
  Briefcase,
  Calendar,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  Coffee,
  Cpu,
  Edit,
  Film,
  Flag,
  Globe,
  Hash,
  Home,
  Inbox,
  Info,
  Layers,
  Link,
  List,
  LogOut,
  Mail,
  Map,
  MessageCircle,
  MoreHorizontal,
  Music,
  Pencil,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  Shield,
  Star,
  Sun,
  ThumbsUp,
  Truck,
  User,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react-native";
import React from "react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  "activity": Activity,
  "alert-circle": AlertCircle,
  "arrow-left": ArrowLeft,
  "bar-chart-2": BarChart2,
  "briefcase": Briefcase,
  "calendar": Calendar,
  "check": Check,
  "check-circle": CheckCircle,
  "chevron-right": ChevronRight,
  "clock": Clock,
  "coffee": Coffee,
  "cpu": Cpu,
  "edit": Edit,
  "edit-2": Pencil,
  "film": Film,
  "flag": Flag,
  "globe": Globe,
  "hash": Hash,
  "home": Home,
  "inbox": Inbox,
  "info": Info,
  "layers": Layers,
  "link": Link,
  "list": List,
  "log-out": LogOut,
  "mail": Mail,
  "map": Map,
  "message-circle": MessageCircle,
  "more-horizontal": MoreHorizontal,
  "music": Music,
  "plus": Plus,
  "plus-circle": PlusCircle,
  "refresh-cw": RefreshCw,
  "search": Search,
  "send": Send,
  "shield": Shield,
  "star": Star,
  "sun": Sun,
  "thumbs-up": ThumbsUp,
  "truck": Truck,
  "user": User,
  "user-check": UserCheck,
  "users": Users,
  "x": X,
  "zap": Zap,
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = "#000", strokeWidth = 2 }: IconProps) {
  const LucideIcon = ICON_MAP[name];
  if (!LucideIcon) {
    if (__DEV__) console.warn(`[Icon] Unknown icon name: "${name}"`);
    return null;
  }
  return <LucideIcon size={size} color={color} strokeWidth={strokeWidth} />;
}
