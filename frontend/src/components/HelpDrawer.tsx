import { useState } from 'react';
import { Drawer, Button, Typography, Collapse, Space } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import helpContent from '../help/index';

const { Text, Paragraph } = Typography;

export default function HelpDrawer() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const pageHelp = helpContent[location.pathname];

  if (!pageHelp) return null;

  return (
    <>
      <Button
        type="text"
        icon={<QuestionCircleOutlined />}
        onClick={() => setOpen(true)}
        title="帮助"
      />
      <Drawer
        title={`帮助 — ${pageHelp.pageTitle}`}
        open={open}
        onClose={() => setOpen(false)}
        width={400}
      >
        <Collapse
          defaultActiveKey={['guide']}
          ghost
          items={[
            {
              key: 'guide',
              label: <Text strong>{pageHelp.guide.title}</Text>,
              children: pageHelp.guide.steps && (
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  {pageHelp.guide.steps.map((step, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>
                      <Text>{step}</Text>
                    </li>
                  ))}
                </ol>
              ),
            },
            {
              key: 'faq',
              label: <Text strong>{pageHelp.faq.title}</Text>,
              children: pageHelp.faq.faq && (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {pageHelp.faq.faq.map((item, i) => (
                    <div key={i}>
                      <Text strong>Q: {item.q}</Text>
                      <Paragraph type="secondary" style={{ marginTop: 4 }}>
                        A: {item.a}
                      </Paragraph>
                    </div>
                  ))}
                </Space>
              ),
            },
          ]}
        />
      </Drawer>
    </>
  );
}
