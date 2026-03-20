import { useState } from 'react';
import { Steps, Button, Space, Modal, Input, message, Typography } from 'antd';
import { SaveOutlined, FolderOpenOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDrafts, createDraft, deleteDraft } from '../api/drafts';
import { usePublishStore } from '../stores/publishStore';
import StepProfiles from '../components/wizard/StepProfiles';
import StepVideos from '../components/wizard/StepVideos';
import StepContent from '../components/wizard/StepContent';
import StepReview from '../components/wizard/StepReview';

const { Title } = Typography;

const stepItems = [
  { title: '选择设备' },
  { title: '分配视频' },
  { title: '编辑内容' },
  { title: '确认发布' },
];

export default function PublishWizard() {
  const step = usePublishStore((s) => s.step);
  const toJson = usePublishStore((s) => s.toJson);
  const fromJson = usePublishStore((s) => s.fromJson);
  const reset = usePublishStore((s) => s.reset);
  const queryClient = useQueryClient();

  // Draft state
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);

  const { data: drafts = [] } = useQuery({
    queryKey: ['drafts'],
    queryFn: getDrafts,
  });

  const saveDraftMutation = useMutation({
    mutationFn: (name: string) => createDraft(name, toJson()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      message.success('草稿已保存');
      setDraftModalOpen(false);
      setSaveName('');
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: deleteDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      message.success('草稿已删除');
    },
  });

  const handleRestore = (dataJson: string) => {
    fromJson(dataJson);
    setRestoreModalOpen(false);
    message.success('草稿已恢复');
  };

  const handleReset = () => {
    Modal.confirm({
      title: '确认重置？',
      content: '将清空当前所有选择和配置。',
      okText: '确认',
      cancelText: '取消',
      onOk: () => reset(),
    });
  };

  return (
    <div>
      {/* Header: title + draft actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>批量发布</Title>
        <Space>
          <Button icon={<SaveOutlined />} onClick={() => setDraftModalOpen(true)}>
            保存草稿
          </Button>
          <Button icon={<FolderOpenOutlined />} onClick={() => setRestoreModalOpen(true)}>
            恢复草稿
          </Button>
          <Button danger onClick={handleReset}>重置</Button>
        </Space>
      </div>

      {/* Steps indicator */}
      <Steps current={step} items={stepItems} style={{ marginBottom: 24 }} />

      {/* Step content */}
      {step === 0 && <StepProfiles />}
      {step === 1 && <StepVideos />}
      {step === 2 && <StepContent />}
      {step === 3 && <StepReview />}

      {/* Save Draft Modal */}
      <Modal
        title="保存草稿"
        open={draftModalOpen}
        onOk={() => saveDraftMutation.mutate(saveName || `草稿 ${new Date().toLocaleString()}`)}
        onCancel={() => setDraftModalOpen(false)}
        confirmLoading={saveDraftMutation.isPending}
        okText="保存"
        cancelText="取消"
      >
        <Input
          placeholder="草稿名称（可选）"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
        />
      </Modal>

      {/* Restore Draft Modal */}
      <Modal
        title="恢复草稿"
        open={restoreModalOpen}
        onCancel={() => setRestoreModalOpen(false)}
        footer={null}
        width={500}
      >
        {drafts.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center' }}>暂无草稿</p>
        ) : (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {drafts.map((draft) => (
              <div
                key={draft.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{draft.name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {new Date(draft.created_at).toLocaleString()}
                  </div>
                </div>
                <Space>
                  <Button size="small" type="primary" onClick={() => handleRestore(draft.data_json)}>
                    恢复
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => deleteDraftMutation.mutate(draft.id)}
                  />
                </Space>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
