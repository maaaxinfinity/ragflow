import { Modal, Table, Button, Space, Breadcrumb, Input } from 'antd';
import { FolderOutlined, FileOutlined, SearchOutlined } from '@ant-design/icons';
import { useState, useCallback, useMemo } from 'react';
import { useTranslate } from '@/hooks/common-hooks';
import { useFetchPureFileList } from '@/hooks/file-manager-hooks';
import type { ColumnsType } from 'antd/es/table';

interface FileSelectorModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (fileIds: string[]) => void;
  loading?: boolean;
}

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  parent_id: string;
}

export const FileSelectorModal: React.FC<FileSelectorModalProps> = ({
  visible,
  onCancel,
  onOk,
  loading = false,
}) => {
  const { t } = useTranslate('fileManager');
  const [currentFolderId, setCurrentFolderId] = useState<string>('');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [searchString, setSearchString] = useState<string>('');
  const [folderPath, setFolderPath] = useState<Array<{ id: string; name: string }>>([
    { id: '', name: t('files') },
  ]);

  const { fetchList, loading: fetchLoading } = useFetchPureFileList();
  const [fileList, setFileList] = useState<FileItem[]>([]);

  // 加载文件列表
  const loadFiles = useCallback(async (folderId: string) => {
    const result = await fetchList(folderId);
    if (result?.code === 0 && result?.data) {
      setFileList(result.data.files || []);
    }
  }, [fetchList]);

  // 初始化时加载根目录
  useState(() => {
    if (visible) {
      loadFiles('');
    }
  });

  // 进入文件夹
  const handleFolderClick = useCallback((folder: FileItem) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    loadFiles(folder.id);
  }, [folderPath, loadFiles]);

  // 面包屑导航
  const handleBreadcrumbClick = useCallback((index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    const targetFolderId = newPath[newPath.length - 1].id;
    setFolderPath(newPath);
    setCurrentFolderId(targetFolderId);
    loadFiles(targetFolderId);
  }, [folderPath, loadFiles]);

  // 递归获取文件夹下所有文件ID
  const getFileIdsRecursively = useCallback(async (folderId: string): Promise<string[]> => {
    const result = await fetchList(folderId);
    if (result?.code !== 0 || !result?.data) {
      return [];
    }

    const files: FileItem[] = result.data.files || [];
    let allFileIds: string[] = [];

    for (const file of files) {
      if (file.type === 'folder') {
        // 递归获取子文件夹中的文件
        const subFileIds = await getFileIdsRecursively(file.id);
        allFileIds = allFileIds.concat(subFileIds);
      } else {
        // 添加文件ID
        allFileIds.push(file.id);
      }
    }

    return allFileIds;
  }, [fetchList]);

  // 处理行选择
  const handleSelectionChange = useCallback(async (selectedKeys: React.Key[], selectedRows: FileItem[]) => {
    // 处理文件夹的递归选择
    let allFileIds: string[] = [];

    for (const row of selectedRows) {
      if (row.type === 'folder') {
        // 递归获取文件夹中的所有文件
        const subFileIds = await getFileIdsRecursively(row.id);
        allFileIds = allFileIds.concat(subFileIds);
      } else {
        allFileIds.push(row.id);
      }
    }

    // 去重
    const uniqueFileIds = Array.from(new Set(allFileIds));
    setSelectedFileIds(uniqueFileIds);
  }, [getFileIdsRecursively]);

  // 过滤文件列表
  const filteredFiles = useMemo(() => {
    if (!searchString) return fileList;
    return fileList.filter(file =>
      file.name.toLowerCase().includes(searchString.toLowerCase())
    );
  }, [fileList, searchString]);

  const columns: ColumnsType<FileItem> = [
    {
      title: t('name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FileItem) => (
        <Space>
          {record.type === 'folder' ? (
            <>
              <FolderOutlined />
              <a onClick={() => handleFolderClick(record)}>{text}</a>
            </>
          ) : (
            <>
              <FileOutlined />
              <span>{text}</span>
            </>
          )}
        </Space>
      ),
    },
    {
      title: t('size'),
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number) => {
        if (size === 0) return '-';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
        return `${(size / 1024 / 1024).toFixed(2)} MB`;
      },
    },
  ];

  const handleOk = () => {
    onOk(selectedFileIds);
    setSelectedFileIds([]);
    setCurrentFolderId('');
    setFolderPath([{ id: '', name: t('files') }]);
    setSearchString('');
  };

  const handleCancel = () => {
    onCancel();
    setSelectedFileIds([]);
    setCurrentFolderId('');
    setFolderPath([{ id: '', name: t('files') }]);
    setSearchString('');
  };

  return (
    <Modal
      title={t('selectFilesToAdd')}
      open={visible}
      onCancel={handleCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={800}
      okButtonProps={{ disabled: selectedFileIds.length === 0 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Breadcrumb>
          {folderPath.map((item, index) => (
            <Breadcrumb.Item key={item.id}>
              <a onClick={() => handleBreadcrumbClick(index)}>{item.name}</a>
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>

        <Input
          placeholder={t('search')}
          prefix={<SearchOutlined />}
          value={searchString}
          onChange={(e) => setSearchString(e.target.value)}
          allowClear
        />

        <div>
          {selectedFileIds.length > 0 ? (
            t('filesSelectedCount', { count: selectedFileIds.length })
          ) : (
            t('noFilesSelected')
          )}
        </div>

        <Table
          rowSelection={{
            selectedRowKeys: selectedFileIds,
            onChange: handleSelectionChange,
          }}
          columns={columns}
          dataSource={filteredFiles}
          rowKey="id"
          loading={fetchLoading}
          pagination={false}
          scroll={{ y: 400 }}
        />
      </Space>
    </Modal>
  );
};
