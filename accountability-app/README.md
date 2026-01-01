# Resolve Together

A mobile accountability app for New Year's resolutions. Track daily meditation and phone-free kid time with a friend to stay accountable together.

## Features

- **20-Minute Meditation Timer**: Guided breathing intro, timer with pause/resume, completion celebration
- **Phone-Free Kid Time Tracker**: Start/stop timer to log present time with kids
- **Streak Tracking**: Current streak, longest streak, and progress toward the 66-day habit formation milestone
- **Friend Accountability**: See your friend's daily progress and streaks
- **Push Notifications**: Daily reminders to complete your goals
- **Beautiful UI**: Dark theme with calming colors optimized for focus

## Research-Backed Design

Based on habit formation research:
- **66 days** to form a lasting habit (Phillippa Lally, UCL)
- **95% higher success rate** with an accountability partner
- **Gentle accountability** - no punishing, just tracking and encouragement
- **Self-compassion** - missing a day doesn't erase progress

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Emulator, or Expo Go app on your phone

### Installation

```bash
# Navigate to the app directory
cd accountability-app

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Running on Your Device

1. Install the **Expo Go** app on your phone (iOS/Android)
2. Scan the QR code shown in the terminal
3. The app will load on your device

### Running on Simulator/Emulator

```bash
# iOS Simulator (Mac only)
npx expo start --ios

# Android Emulator
npx expo start --android
```

## Backend Setup (Optional)

For friend syncing to work, you need a backend. We recommend **Supabase**:

### Supabase Setup

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to SQL Editor and run the schema in `lib/supabase.ts`
4. Get your project URL and anon key from Settings > API
5. Create `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Project Structure

```
accountability-app/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Today screen
│   │   ├── progress.tsx   # Progress/stats
│   │   ├── together.tsx   # Friend view
│   │   └── settings.tsx   # Settings
│   ├── meditation-session.tsx
│   ├── phone-free-session.tsx
│   ├── onboarding.tsx
│   └── _layout.tsx
├── store/
│   └── useStore.ts        # Zustand state management
├── lib/
│   ├── api.ts             # API client interface
│   └── supabase.ts        # Supabase client
├── constants/
│   └── colors.ts          # Theme colors
└── assets/
    └── sounds/            # Notification sounds
```

## Building for Production

```bash
# Build for iOS
npx expo build:ios

# Build for Android
npx expo build:android

# Or use EAS Build (recommended)
npx eas build --platform all
```

## Customization

### Change Meditation Duration

In `app/meditation-session.tsx`:
```typescript
const MEDITATION_DURATION = 20 * 60; // Change 20 to your desired minutes
```

### Add More Goals

1. Update the `DayLog` interface in `store/useStore.ts`
2. Add new tracking fields
3. Create new timer/tracking screens
4. Update the Today and Progress screens

### Change Theme Colors

Edit `constants/colors.ts` to customize the color palette.

## Contributing

Feel free to submit issues and pull requests!

## License

MIT
