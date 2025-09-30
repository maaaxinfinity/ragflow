import React, { useState, useRef } from 'react';
import { Upload, Button, message, Modal, Input, Form, Select, Progress, Tree } from 'antd';
import { FolderAddOutlined, FolderOpenOutlined, FileOutlined } from '@ant-design/icons';
import { UploadProps } from 'antd/lib/upload';
import request from 'umi-request';
import { useTranslation } from 'react-i18next';

interface FolderUploadProps {
  parentId?: string;
  onSuccess?: (data: any) => void;
}

interface FileWithPath extends File {
  path?: string;
  webkitRelativePath?: string;
}

export const FolderUpload: React.FC<FolderUploadProps> = ({ parentId, onSuccess }) => {
  const { t } = useTranslation();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<FileWithPath[]>([]);
  const [folderStructure, setFolderStructure] = useState<any[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFolderSelect = () => {
    // Create hidden input for folder selection
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;

    input.onchange = (e: any) => {
      const files = Array.from(e.target.files) as FileWithPath[];
      processFiles(files);
    };

    input.click();
  };

  const processFiles = (files: FileWithPath[]) => {
    // Build folder structure from files
    const structure: any = {};

    files.forEach((file) => {
      const path = file.webkitRelativePath || file.name;
      const parts = path.split('/');

      let current = structure;
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // It's a file
          if (!current.files) current.files = [];
          current.files.push({
            name: part,
            file: file,
            path: path
          });
        } else {
          // It's a folder
          if (!current.folders) current.folders = {};
          if (!current.folders[part]) {
            current.folders[part] = {};
          }
          current = current.folders[part];
        }
      });
    });

    setFileList(files);
    setFolderStructure(convertToTreeData(structure));
  };

  const convertToTreeData = (structure: any, parentKey = ''): any[] => {
    const treeData: any[] = [];

    // Add folders
    if (structure.folders) {
      Object.entries(structure.folders).forEach(([name, content]) => {
        const key = parentKey ? `${parentKey}/${name}` : name;
        treeData.push({
          title: name,
          key: key,
          icon: <FolderOpenOutlined />,
          children: convertToTreeData(content, key)
        });
      });
    }

    // Add files
    if (structure.files) {
      structure.files.forEach((file: any) => {
        const key = parentKey ? `${parentKey}/${file.name}` : file.name;
        treeData.push({
          title: file.name,
          key: key,
          icon: <FileOutlined />,
          isLeaf: true
        });
      });
    }

    return treeData;
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('Please select files to upload');
      return;
    }

    setUploading(true);
    const formData = new FormData();

    // Add parent ID if provided
    if (parentId) {
      formData.append('parent_id', parentId);
    }

    // Add files and their paths
    fileList.forEach((file) => {
      formData.append('files', file);
      formData.append('folder_path', file.webkitRelativePath || file.name);
    });

    try {
      // 不设置 Content-Type，让浏览器自动设置 boundary
      const response = await request('/v1/file_folder/upload_folder', {
        method: 'POST',
        data: formData,
      });

      // response 已经被拦截器解包，结构是: { code: 0, data: {...}, message: '' }
      if (response.code === 0) {
        const result = response.data;
        message.success(
          t('fileManager.uploadFolderSuccess', {
            files: result.total_files || 0,
            folders: result.total_folders || 0,
          })
        );
        onSuccess?.(result);
        setFileList([]);
        setFolderStructure([]);
      } else {
        message.error(response.message || t('fileManager.uploadFailed'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      message.error(t('fileManager.uploadFailed'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="folder-upload">
      <Button
        type="primary"
        icon={<FolderAddOutlined />}
        onClick={handleFolderSelect}
        disabled={uploading}
      >
        {t('fileManager.selectFolder')}
      </Button>

      {fileList.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 10 }}>
            {t('fileManager.selectedFiles', { count: fileList.length })}
          </div>

          <Tree
            treeData={folderStructure}
            defaultExpandAll
            height={300}
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              padding: 8,
              marginBottom: 16
            }}
          />

          {uploading && (
            <Progress percent={uploadProgress} style={{ marginBottom: 16 }} />
          )}

          <Button
            type="primary"
            onClick={handleUpload}
            loading={uploading}
          >
            {t('fileManager.uploadAllFiles')}
          </Button>
        </div>
      )}
    </div>
  );
};

interface CreateKBFromFolderProps {
  visible: boolean;
  folderId: string;
  folderName: string;
  onCancel: () => void;
  onSuccess: (data: any) => void;
}

export const CreateKBFromFolder: React.FC<CreateKBFromFolderProps> = ({
  visible,
  folderId,
  folderName,
  onCancel,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await request('/v1/file_folder/create_kb_from_folder', {
        method: 'POST',
        data: {
          folder_id: folderId,
          kb_name: values.kb_name,
          description: values.description || '',
          parser_id: values.parser_id || 'naive',
        },
      });

      // response 已经被拦截器解包，结构是: { code: 0, data: {...}, message: '' }
      if (response.code === 0) {
        const result = response.data;
        message.success(
          t('fileManager.createKBSuccess', {
            count: result.documents_added || 0,
          })
        );
        onSuccess(result);
        form.resetFields();
      } else {
        message.error(response.message || t('fileManager.createKBFailed'));
      }
    } catch (error) {
      console.error('KB creation error:', error);
      message.error(t('fileManager.createKBFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('fileManager.createKBFromFolder', { name: folderName })}
      open={visible}
      onCancel={onCancel}
      onOk={handleCreate}
      confirmLoading={loading}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          kb_name: folderName,
          parser_id: 'naive',
        }}
      >
        <Form.Item
          name="kb_name"
          label={t('fileManager.kbName')}
          rules={[{ required: true, message: t('common.namePlaceholder') }]}
        >
          <Input placeholder={t('fileManager.kbNamePlaceholder')} />
        </Form.Item>

        <Form.Item
          name="description"
          label={t('fileManager.description')}
        >
          <Input.TextArea
            rows={3}
            placeholder={t('fileManager.descriptionPlaceholder')}
          />
        </Form.Item>

        <Form.Item
          name="parser_id"
          label={t('fileManager.parserType')}
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value="naive">{t('fileManager.parserGeneral')}</Select.Option>
            <Select.Option value="paper">{t('fileManager.parserPaper')}</Select.Option>
            <Select.Option value="book">{t('fileManager.parserBook')}</Select.Option>
            <Select.Option value="laws">{t('fileManager.parserLaws')}</Select.Option>
            <Select.Option value="manual">{t('fileManager.parserManual')}</Select.Option>
            <Select.Option value="qa">{t('fileManager.parserQA')}</Select.Option>
            <Select.Option value="table">{t('fileManager.parserTable')}</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};