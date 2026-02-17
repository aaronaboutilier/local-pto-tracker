import { PTO_COLORS } from './constants/pto'

export const mockEvents = [
  {
    id: '1',
    title: 'Company Holiday',
    start: '2026-02-16',
    allDay: true,
    extendedProps: {
      type: 'holiday',
      hours: 7.5,
    },
    color: PTO_COLORS.holiday,
  },
  {
    id: '2',
    title: 'PTO - Alex Kim',
    start: '2026-02-24',
    end: '2026-02-27',
    allDay: true,
    extendedProps: {
      type: 'vacation',
      hours: 22.5,
    },
    color: PTO_COLORS.vacation,
  },
  {
    id: '3',
    title: 'Team Standup',
    start: '2026-02-13T09:30:00',
    end: '2026-02-13T10:00:00',
    extendedProps: {
      type: 'sick',
      hours: 0.5,
    },
    color: PTO_COLORS.sick,
  },
  {
    id: '4',
    title: '1:1 - Manager',
    start: '2026-02-13T14:00:00',
    end: '2026-02-13T14:30:00',
    extendedProps: {
      type: 'personal',
      hours: 0.5,
    },
    color: PTO_COLORS.personal,
  },
  {
    id: '5',
    title: 'PTO - Priya Nair',
    start: '2026-03-02',
    end: '2026-03-04',
    allDay: true,
    extendedProps: {
      type: 'vpp',
      hours: 15,
    },
    color: PTO_COLORS.vpp,
  },
  {
    id: '6',
    title: 'Design Review',
    start: '2026-03-05T11:00:00',
    end: '2026-03-05T12:00:00',
    extendedProps: {
      type: 'vacation',
      hours: 1,
    },
    color: PTO_COLORS.vacation,
  },
  {
    id: '7',
    title: 'PTO - Jordan Lee',
    start: '2026-07-14',
    end: '2026-07-18',
    allDay: true,
    extendedProps: {
      type: 'vacation',
      hours: 30,
    },
    color: PTO_COLORS.vacation,
  },
  {
    id: '8',
    title: 'Planning Session',
    start: '2026-07-15T13:00:00',
    end: '2026-07-15T15:00:00',
    extendedProps: {
      type: 'sick',
      hours: 2,
    },
    color: PTO_COLORS.sick,
  },
]
