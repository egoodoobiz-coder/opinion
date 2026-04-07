import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  Briefcase,
  Calendar,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  Edit,
  Hash,
  Home,
  Inbox,
  Info,
  Layers,
  Link,
  List,
  LogOut,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  Shield,
  Star,
  ThumbsUp,
  User,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react-native";
import React from "react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  "alert-circle": AlertCircle,
  "arrow-left": ArrowLeft,
  "bar-chart-2": BarChart2,
  "briefcase": Briefcase,
  "calendar": Calendar,
  "check": Check,
  "check-circle": CheckCircle,
  "chevron-right": ChevronRight,
  "clock": Clock,
  "edit": Edit,
  "edit-2": Pencil,
  "hash": Hash,
  "home": Home,
  "inbox": Inbox,
  "info": Info,
  "layers": Layers,
  "link": Link,
  "list": List,
  "log-out": LogOut,
  "mail": Mail,
  "message-circle": MessageCircle,
  "plus": Plus,
  "plus-circle": PlusCircle,
  "refresh-cw": RefreshCw,
  "search": Search,
  "send": Send,
  "shield": Shield,
  "star": Star,
  "thumbs-up": ThumbsUp,
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
