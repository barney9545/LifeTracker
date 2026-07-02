/**
 * @lifetracker/ui — framework-agnostic presentational design kit.
 *
 * Import the stylesheet once in your app (ships the tokens + component classes):
 *   import "@lifetracker/ui/styles.css";
 * Wrap your tree in a theme class: <div className="theme-lavender"> … </div>
 */

// Tokens & helpers
export {
  themes,
  radii,
  timeOfDayColors,
  todColor,
  complianceColor,
  type ThemeName,
  type TimeOfDay,
} from "./tokens";

export { cx } from "./cx";

// Primitives
export {
  Button,
  Input,
  Textarea,
  Select,
  Card,
  SectionLabel,
  Chip,
  Badge,
  ProgressBar,
  CheckCircle,
  Avatar,
  type ButtonProps,
  type ButtonVariant,
  type InputProps,
  type TextareaProps,
  type SelectProps,
  type SelectOption,
  type CardProps,
  type ChipProps,
  type ChipTone,
  type ProgressBarProps,
  type CheckCircleProps,
  type AvatarProps,
} from "./primitives";

// Composites
export {
  SupplementCard,
  type SupplementCardProps,
  type SupplementVariant,
} from "./SupplementCard";
export { ProgressCard, type ProgressCardProps, type ProgressStat } from "./ProgressCard";
export { ItemRow, type ItemRowProps, type ItemRowAction } from "./ItemRow";
export {
  CalendarDayCell,
  MonthCalendar,
  type CalendarDayCellProps,
  type MonthCalendarProps,
  type MonthCalendarDay,
} from "./Calendar";
export { TabSwitch, type TabSwitchProps, type TabItem } from "./TabSwitch";
export {
  BottomNav,
  HomeIcon,
  PillIcon,
  ChartIcon,
  type BottomNavProps,
  type BottomNavItem,
} from "./BottomNav";
