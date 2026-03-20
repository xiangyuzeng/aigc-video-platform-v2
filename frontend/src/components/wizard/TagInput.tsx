import { useState, useCallback } from 'react';
import { Select, Tag, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { suggestTags, getRecentTags } from '../../api/tags';
import { formatTags, parseTags } from '../../utils/tagFormatter';

interface TagInputProps {
  value: string;
  onChange: (val: string) => void;
  platform?: string;
}

export default function TagInput({ value, onChange, platform = 'tiktok' }: TagInputProps) {
  const [searchText, setSearchText] = useState('');

  const { data: suggestions = [] } = useQuery({
    queryKey: ['tag-suggestions', searchText, platform],
    queryFn: () => suggestTags(searchText, platform),
    enabled: searchText.length > 0,
  });

  const { data: recentTags = [] } = useQuery({
    queryKey: ['recent-tags', platform],
    queryFn: () => getRecentTags(platform),
  });

  const selectedTags = parseTags(value);

  const handleChange = useCallback(
    (tags: string[]) => {
      const joined = tags
        .map((t) => (t.startsWith('#') ? t : `#${t}`))
        .join(' ');
      onChange(joined);
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    const formatted = formatTags(value);
    onChange(formatted);
  }, [value, onChange]);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const handleSearch = useCallback(
    (text: string) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setSearchText(text);
      }, 300);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleRecentTagClick = useCallback(
    (tag: string) => {
      const current = parseTags(value);
      const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
      if (current.some((t) => t.toLowerCase() === normalizedTag.toLowerCase())) {
        return;
      }
      const updated = [...current, normalizedTag].join(' ');
      onChange(formatTags(updated));
    },
    [value, onChange],
  );

  const options = suggestions.map((s) => ({
    value: s.tag.startsWith('#') ? s.tag : `#${s.tag}`,
    label: `${s.tag.startsWith('#') ? s.tag : `#${s.tag}`} (${s.use_count})`,
  }));

  return (
    <div>
      <Select
        mode="tags"
        style={{ width: '100%' }}
        placeholder="输入标签，如 #fashion #ootd"
        value={selectedTags}
        onChange={handleChange}
        onBlur={handleBlur}
        onSearch={handleSearch}
        options={options}
        tokenSeparators={[' ', ',', '，']}
      />
      {recentTags.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span style={{ marginRight: 8, color: '#999', fontSize: 12 }}>
            最近使用:
          </span>
          <Space size={[4, 4]} wrap>
            {recentTags.map((item) => {
              const tagText = item.tag.startsWith('#') ? item.tag : `#${item.tag}`;
              return (
                <Tag
                  key={item.tag}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleRecentTagClick(item.tag)}
                >
                  {tagText}
                </Tag>
              );
            })}
          </Space>
        </div>
      )}
    </div>
  );
}
