import { Switch, Select, Button, Popover, Tag, Space, Tooltip } from 'antd';
import { BookOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { useState, useEffect, useMemo } from 'react';
import { useFetchKnowledgeBaseList } from '@/hooks/knowledge-base-hooks';
import styles from './knowledge-base-selector.less';

interface KnowledgeBaseSelectorProps {
  sessionId: string | null;
  selectedKbIds: string[];
  onKbChange: (kbIds: string[], enabled: boolean) => void;
  onKbToggle: (enabled: boolean) => void;
  kbEnabled: boolean;
}

export const KnowledgeBaseSelector: React.FC<KnowledgeBaseSelectorProps> = ({
  sessionId,
  selectedKbIds,
  onKbChange,
  onKbToggle,
  kbEnabled,
}) => {
  const [visible, setVisible] = useState(false);
  const [tempSelectedKbs, setTempSelectedKbs] = useState<string[]>(selectedKbIds);
  const { data: knowledgeBases = [], loading } = useFetchKnowledgeBaseList();

  useEffect(() => {
    setTempSelectedKbs(selectedKbIds);
  }, [selectedKbIds]);

  const selectedKbNames = useMemo(() => {
    return tempSelectedKbs.map(id => {
      const kb = knowledgeBases.find(k => k.id === id);
      return kb ? kb.name : id;
    });
  }, [tempSelectedKbs, knowledgeBases]);

  const handleAddKb = (kbId: string) => {
    if (!tempSelectedKbs.includes(kbId)) {
      const newKbs = [...tempSelectedKbs, kbId];
      setTempSelectedKbs(newKbs);
      onKbChange(newKbs, kbEnabled);
    }
  };

  const handleRemoveKb = (kbId: string) => {
    const newKbs = tempSelectedKbs.filter(id => id !== kbId);
    setTempSelectedKbs(newKbs);
    onKbChange(newKbs, kbEnabled);
  };

  const handleToggle = (checked: boolean) => {
    onKbToggle(checked);
  };

  const content = (
    <div style={{ width: 400 }}>
      <div style={{ marginBottom: 16 }}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500 }}>知识库设置</span>
          <Switch
            checked={kbEnabled}
            onChange={handleToggle}
            checkedChildren="启用"
            unCheckedChildren="关闭"
          />
        </Space>
      </div>

      {kbEnabled && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Select
              style={{ width: '100%' }}
              placeholder="选择知识库"
              loading={loading}
              onChange={handleAddKb}
              value={null}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              options={knowledgeBases
                .filter(kb => !tempSelectedKbs.includes(kb.id))
                .map(kb => ({
                  value: kb.id,
                  label: kb.name,
                }))}
            />
          </div>

          <div>
            <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
              已选择的知识库 ({tempSelectedKbs.length})
            </div>
            <Space size={[8, 8]} wrap>
              {tempSelectedKbs.map((kbId, index) => {
                const kb = knowledgeBases.find(k => k.id === kbId);
                return (
                  <Tag
                    key={kbId}
                    closable
                    onClose={() => handleRemoveKb(kbId)}
                    color="blue"
                  >
                    {kb?.name || kbId}
                  </Tag>
                );
              })}
              {tempSelectedKbs.length === 0 && (
                <span style={{ color: '#999', fontSize: 12 }}>未选择任何知识库</span>
              )}
            </Space>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={styles.knowledgeBaseSelector}>
      <Popover
        content={content}
        title={null}
        trigger="click"
        open={visible}
        onOpenChange={setVisible}
        placement="topRight"
      >
        <Button
          icon={<BookOutlined />}
          type={kbEnabled ? 'primary' : 'default'}
          ghost={kbEnabled}
        >
          知识库
          {kbEnabled && tempSelectedKbs.length > 0 && (
            <span style={{ marginLeft: 4 }}>({tempSelectedKbs.length})</span>
          )}
        </Button>
      </Popover>

      {kbEnabled && tempSelectedKbs.length > 0 && (
        <Tooltip title="已启用知识库">
          <span style={{ marginLeft: 8, color: '#52c41a' }}>●</span>
        </Tooltip>
      )}
    </div>
  );
};