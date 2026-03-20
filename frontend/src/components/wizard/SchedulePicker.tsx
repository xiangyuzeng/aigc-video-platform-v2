import { DatePicker, Select, Space } from 'antd';
import dayjs from 'dayjs';
import { TIMEZONE_PRESETS } from '../../utils/constants';

interface SchedulePickerProps {
  scheduledAt: string | null;
  timezone: string;
  onScheduledAtChange: (val: string | null) => void;
  onTimezoneChange: (val: string) => void;
}

const timezoneOptions = TIMEZONE_PRESETS.map((tz) => ({
  value: tz.value,
  label: tz.label,
}));

export default function SchedulePicker({
  scheduledAt,
  timezone,
  onScheduledAtChange,
  onTimezoneChange,
}: SchedulePickerProps) {
  const dayjsValue = scheduledAt ? dayjs(scheduledAt) : null;

  const handleDateChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      onScheduledAtChange(date.toISOString());
    } else {
      onScheduledAtChange(null);
    }
  };

  return (
    <Space>
      <DatePicker
        showTime
        value={dayjsValue}
        onChange={handleDateChange}
        placeholder="选择发布时间"
        style={{ width: 220 }}
      />
      <Select
        value={timezone}
        onChange={onTimezoneChange}
        options={timezoneOptions}
        style={{ width: 240 }}
        placeholder="选择时区"
      />
    </Space>
  );
}
