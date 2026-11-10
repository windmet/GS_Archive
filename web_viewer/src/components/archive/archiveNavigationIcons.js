import { BookOpen, FolderOpen, Home, Images, MessageCircle, Music, Sparkles, Users, CalendarDays, Box, Camera, Medal, MicVocal, Aperture, Coins, Shirt, AudioLines, LayoutGrid, Headphones, IdCard } from '@lucide/vue'

// Shared visual vocabulary, keyed by the section ids of core/archiveSections.js (which owns the names).
export const archiveNavigationIcons = {
// One person's profile (偶像) against several people (组合); a song against its score (配乐); a stage mic for LIVE.
  home: Home, portal: LayoutGrid, stories: BookOpen, songs: Music, scores: Headphones, idols: IdCard, units: Users,
  cards: Images, gashas: Sparkles, interactions: MessageCircle, resources: FolderOpen,
  events:CalendarDays, collections:Box, honors:Medal, currencies:Coins, costumes:Shirt, photos:Camera, live:MicVocal, studio:Aperture, unused:AudioLines,
}
