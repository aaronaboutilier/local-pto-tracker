# Local PTO Tracker

A local-first PTO (Paid Time Off) tracker built with Vue 3 and Vite. This application helps you manage and track your vacation, VPP (Vacation Purchase Program), sick days, and personal time off with fiscal year accounting.

## Features

- **Local-First Storage**: All data is stored locally in your browser using `localStorage` - no server required
- **Fiscal Year Tracking**: Configurable fiscal year boundaries (default starts in April)
- **Configurable PTO Buckets**: Defaults to VPP Vacation, Regular Vacation, Sick Days, and Personal Days, and you can add or remove buckets with custom names, colors, and allocations
- **Calendar Integration**: Built with FullCalendar for month, week, day, and year views
- **Event Management**: Create, edit, and delete PTO events with custom metadata
- **Progress Tracking**: Visual progress bars show usage and remaining balance for each PTO bucket
- **Customizable Settings**: Configure hours per day and fiscal year start month
- **Per-Year Balances**: Set different PTO balances for each fiscal year
- **Optional File System Sync**: In Chromium browsers, pick a local JSON file and auto-sync updates to it while the app is open

## Tech Stack

- Vue 3 with `<script setup>` SFCs
- Vite for fast development and building
- FullCalendar for calendar rendering
- localStorage for data persistence

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Backup & Restore

The app remains local-first by default. Your data is always stored in `localStorage` and works without any cloud account.

- Open **Settings** in the tracker panel.
- Use **Enable file sync** to choose a local JSON file for sync.
- Use **Restore from file** to load data from a selected sync file and switch syncing to that file.

### Optional file system sync

File system sync is optional and local-only. It uses the File System Access API and works best in Chromium browsers (Chrome/Edge).

How it works:

- In **Settings**, click **Enable file sync** and choose a `.json` file.
- Changes are auto-synced (debounced) to that file while sync is enabled.
- Use **Sync now** for a manual write.
- Use **Restore from file** at any time to choose a file, restore local data from it, and start syncing with that selected file.
- Use **Disable sync** to stop writing in the current session.

Notes:

- localStorage remains the default source of truth unless you explicitly restore from a sync file.
- For unsupported browsers (such as most Safari/Firefox contexts), file sync is unavailable in-app.

## Learn More

- [Vue 3 Documentation](https://vuejs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [FullCalendar Documentation](https://fullcalendar.io/)
