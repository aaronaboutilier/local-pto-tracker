# Local PTO Tracker

A local-first PTO (Paid Time Off) tracker built with Vue 3 and Vite. This application helps you manage and track your vacation, VPP (Vacation Purchase Program), sick days, and personal time off with fiscal year accounting.

## Features

- **Local-First Storage**: All data is stored locally in your browser using `localStorage` - no server required
- **Fiscal Year Tracking**: Configurable fiscal year boundaries (default starts in April)
- **Multiple PTO Buckets**: Track four types of time off:
  - VPP Vacation
  - Regular Vacation
  - Sick Days
  - Personal Days
- **Calendar Integration**: Built with FullCalendar for month, week, day, and year views
- **Event Management**: Create, edit, and delete PTO events with custom metadata
- **Progress Tracking**: Visual progress bars show usage and remaining balance for each PTO bucket
- **Customizable Settings**: Configure hours per day and fiscal year start month
- **Per-Year Balances**: Set different PTO balances for each fiscal year

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

## Learn More

- [Vue 3 Documentation](https://vuejs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [FullCalendar Documentation](https://fullcalendar.io/)