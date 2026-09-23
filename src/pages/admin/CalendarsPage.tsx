import { useEffect, useState, useCallback } from 'react';
import { dbClient } from '@/lib/dbClient';
import { Card, CardBody, CardHeader, Spinner, Button, Input, Modal, EmptyState } from '@/components/ui';
import { Badge } from '@/components/ui/Badges';
import type { BusinessCalendar, BusinessCalendarHour, HolidayDate } from '@/types';
import { Plus, Calendar, Clock } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function CalendarsPage() {
  const [calendars, setCalendars] = useState<(BusinessCalendar & { hours?: BusinessCalendarHour[]; holidays?: HolidayDate[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', timezone: 'UTC', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: calData } = await dbClient.from('business_calendars').select('*').order('name');
    if (calData) {
      const withDetails = await Promise.all(
        (calData as BusinessCalendar[]).map(async (cal) => {
          const { data: hours } = await dbClient.from('business_calendar_hours').select('*').eq('calendar_id', cal.id).order('day_of_week');
          const { data: holidays } = await dbClient.from('holiday_dates').select('*').eq('calendar_id', cal.id).order('holiday_date');
          return { ...cal, hours: hours || [], holidays: holidays || [] };
        })
      );
      setCalendars(withDetails);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    await dbClient.from('business_calendars').insert({ name: form.name, timezone: form.timezone, description: form.description || null, is_active: true });
    setShowModal(false);
    setForm({ name: '', timezone: 'UTC', description: '' });
    load();
  };

  if (loading) return <Spinner label="Loading calendars..." />;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Calendars</h1>
          <p className="text-sm text-gray-500 mt-1">{calendars.length} calendar{calendars.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4" /> New Calendar</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {calendars.map((cal) => (
          <Card key={cal.id}>
            <CardHeader title={cal.name} subtitle={`${cal.timezone} - ${cal.holidays?.length || 0} holidays`} action={<Badge color={cal.is_active ? 'green' : 'gray'}>{cal.is_active ? 'Active' : 'Inactive'}</Badge>} />
            <CardBody>
              <div className="space-y-2">
                {DAYS.map((day, idx) => {
                  const hours = cal.hours?.find((h: BusinessCalendarHour) => h.day_of_week === idx);
                  return (
                    <div key={day} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{day}</span>
                      {hours?.is_closed || !hours?.open_time ? (
                        <span className="text-gray-400">Closed</span>
                      ) : (
                        <span className="text-gray-900 font-medium">{hours.open_time} - {hours.close_time}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {cal.holidays && cal.holidays.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Holidays</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cal.holidays.map((h: HolidayDate) => (
                      <Badge key={h.id} color="red">{h.name} ({new Date(h.holiday_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        ))}
        {calendars.length === 0 && <EmptyState icon={<Calendar className="w-12 h-12" />} title="No calendars" />}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Business Calendar">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Input label="Timezone" value={form.timezone} onChange={(v) => setForm({ ...form, timezone: v })} placeholder="UTC, America/New_York, etc." />
          <Input label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
