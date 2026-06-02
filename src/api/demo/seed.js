// Seed data for DEMO MODE (no backend). Fictitious.
// Classes are placed on *today's* weekday so the "Today" views show content.

const todayDow = new Date().getDay();
const otherDow = (todayDow + 2) % 7;
const todayISO = new Date().toISOString().slice(0, 10);

export const DEMO_USERS = [
  { id: 'usr-admin', email: 'admin@mlda.demo',   full_name: 'Tyler (Admin)', role: 'admin' },
  { id: 'usr-jamie', email: 'parent@mlda.demo',  full_name: 'Jamie Smith',   role: 'parent' },
  { id: 'usr-dana',  email: 'teacher@mlda.demo', full_name: 'Dana Reed',     role: 'teacher' },
  { id: 'usr-ava',   email: 'dancer@mlda.demo',  full_name: 'Ava Smith',     role: 'dancer' },
];

export function buildSeed() {
  return {
    profiles: [
      ...DEMO_USERS,
      { id: 'usr-chris', email: 'chris@smithfamily.demo', full_name: 'Chris Smith', role: 'parent' },
    ],
    studios: [
      { id: 'std-a', name: 'A' }, { id: 'std-b', name: 'B' }, { id: 'std-c', name: 'C' },
    ],
    teachers: [
      { id: 'tch-dana', profile_id: 'usr-dana', first_name: 'Dana', last_name: 'Reed', initials: 'DR', email: 'teacher@mlda.demo', phone: '', ics_token: 'ics-dana', notification_prefs: {}, archived: false },
      { id: 'tch-lee', profile_id: null, first_name: 'Marcus', last_name: 'Lee', initials: 'ML', email: 'lee@mlda.demo', phone: '', ics_token: 'ics-lee', notification_prefs: {}, archived: false },
    ],
    households: [
      { id: 'hh-smith', primary_contact_name: 'The Smith Family', email: 'parent@mlda.demo', phone: '555-0101', ics_token: 'ics-smith', notification_prefs: {} },
      { id: 'hh-garcia', primary_contact_name: 'The Garcia Family', email: 'garcia@mlda.demo', phone: '555-0102', ics_token: 'ics-garcia', notification_prefs: {} },
      { id: 'hh-okafor', primary_contact_name: 'The Okafor Family', email: 'okafor@mlda.demo', phone: '555-0103', ics_token: 'ics-okafor', notification_prefs: {} },
    ],
    household_members: [
      { id: 'hm-1', household_id: 'hh-smith', profile_id: 'usr-jamie', relationship: 'mother', is_primary: true, can_manage: true },
      { id: 'hm-2', household_id: 'hh-smith', profile_id: 'usr-chris', relationship: 'father', is_primary: false, can_manage: true },
    ],
    dancers: [
      { id: 'dnc-ava', first_name: 'Ava', last_name: 'Smith', dob: '2013-04-02', program: 'Competitive', level: 'Premier', parent_household_id: 'hh-smith', profile_id: 'usr-ava', archived: false },
      { id: 'dnc-mia', first_name: 'Mia', last_name: 'Smith', dob: '2015-09-10', program: 'Competitive', level: 'Superstar', parent_household_id: 'hh-smith', profile_id: null, archived: false },
      { id: 'dnc-noah', first_name: 'Noah', last_name: 'Garcia', dob: '2014-01-22', program: 'Educational', level: 'Junior', parent_household_id: 'hh-garcia', profile_id: null, archived: false },
    ],
    dance_classes: [
      { id: 'cls-lyrical', title: 'Lyrical — Senior', day_of_week: todayDow, one_time_date: null, start_time: '17:00', end_time: '18:15', studio_id: 'std-a', teacher_id: 'tch-dana', guest_artist: false, guest_artist_name: '', level: 'Premier', age_range: '13-18', week_variant: '' },
      { id: 'cls-ballet', title: 'Ballet Technique', day_of_week: todayDow, one_time_date: null, start_time: '18:30', end_time: '19:30', studio_id: 'std-b', teacher_id: 'tch-dana', guest_artist: false, guest_artist_name: '', level: 'Premier', age_range: '13-18', week_variant: '' },
      { id: 'cls-jazz', title: 'Jazz — Junior', day_of_week: todayDow, one_time_date: null, start_time: '17:30', end_time: '18:30', studio_id: 'std-c', teacher_id: 'tch-lee', guest_artist: false, guest_artist_name: '', level: 'Superstar', age_range: '8-12', week_variant: '' },
      { id: 'cls-contemp', title: 'Contemporary — Teen', day_of_week: otherDow, one_time_date: null, start_time: '18:00', end_time: '19:15', studio_id: 'std-a', teacher_id: 'tch-dana', guest_artist: false, guest_artist_name: '', level: 'Premier', age_range: '13-18', week_variant: '' },
    ],
    class_enrollments: [
      { id: 'en-1', class_id: 'cls-lyrical', dancer_id: 'dnc-ava', active: true },
      { id: 'en-2', class_id: 'cls-ballet', dancer_id: 'dnc-ava', active: true },
      { id: 'en-3', class_id: 'cls-jazz', dancer_id: 'dnc-mia', active: true },
      { id: 'en-4', class_id: 'cls-contemp', dancer_id: 'dnc-noah', active: true },
    ],
    pieces: [
      { id: 'pc-rise', title: 'Rise', choreographer: 'Dana Reed', season: '2025-26', level: 'Premier' },
      { id: 'pc-embers', title: 'Embers', choreographer: 'Marcus Lee', season: '2025-26', level: 'Superstar' },
    ],
    piece_casts: [
      { id: 'cast-1', piece_id: 'pc-rise', dancer_id: 'dnc-ava' },
      { id: 'cast-2', piece_id: 'pc-embers', dancer_id: 'dnc-mia' },
    ],
    rehearsal_blocks: [
      { id: 'rb-1', date: todayISO, start_time: '18:30', end_time: '19:30', studio_id: 'std-b', teacher_id: 'tch-dana', notes: 'Rise cleaning', piece_ids: ['pc-rise'], dancer_ids: ['dnc-ava'] },
    ],
    space_bookings: [],
    competition_weekends: [
      { id: 'cw-1', name: 'Spotlight Regionals', start_date: '2026-03-14', end_date: '2026-03-15', venue: 'Civic Center', notes: '', competing_entries: [] },
    ],
    competition_shifts: [
      { id: 'cs-1', competition_weekend_id: 'cw-1', date: '2026-03-14', start_time: '08:00', end_time: '14:00', teacher_id: 'tch-dana', role: 'Backstage lead' },
    ],
    schedule_exceptions: [
      { id: 'ex-1', class_id: 'cls-ballet', date: todayISO, type: 'dancer_pulled', dancer_id: 'dnc-ava', rehearsal_block_id: 'rb-1', new_time: null, new_studio_id: null, new_teacher_id: null, reason: 'Pulled to Rise rehearsal' },
    ],
    attendance_records: [],
    absence_reports: [
      { id: 'ab-1', dancer_id: 'dnc-mia', household_id: 'hh-smith', start_date: todayISO, end_date: todayISO, class_ids: ['cls-jazz'], reason: 'Doctor appointment', excused: true, document_url: '', status: 'pending', admin_notes: '', messages: [] },
    ],
    schedule_notifications: [
      { id: 'nt-1', recipient_email: 'parent@mlda.demo', recipient_type: 'parent', type: 'daily_digest', title: "Today's Schedule", message: 'Ava: Lyrical 5:00 PM | Ballet 6:30 PM', payload: {}, read: false },
    ],
    app_settings: [
      { id: 1, global_notifications_enabled: true, jackrabbit_api_key: '' },
    ],
  };
}
