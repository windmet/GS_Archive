import { BookOpen, FolderOpen, Home, Images, MessageCircle, Music, Sparkles, Users, CalendarDays, Box, Camera, Medal, Clapperboard, Layers, Coins, Shirt, AudioLines, LayoutGrid } from '@lucide/vue'

// Shared visual vocabulary, keyed by the section ids of core/archiveSections.js (which owns the names).
export const archiveNavigationIcons = {
  home: Home, portal: LayoutGrid, stories: BookOpen, songs: Music, idols: Users,
  cards: Images, gashas: Sparkles, interactions: MessageCircle, resources: FolderOpen,
  events:CalendarDays, collections:Box, honors:Medal, currencies:Coins, costumes:Shirt, photos:Camera, live:Clapperboard, studio:Layers, unused:AudioLines,
}
