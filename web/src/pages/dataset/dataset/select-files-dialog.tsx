import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { useFetchPureFileList } from '@/hooks/file-manager-hooks';
import { File, Folder, Search } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SelectFilesDialogProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (fileIds: string[]) => void;
  loading?: boolean;
}

interface FileItem {
  id: string;
  name: string;
  type: string;
  parent_id: string;
}

interface FolderPath {
  id: string;
  name: string;
}

export function SelectFilesDialog({
  visible,
  onCancel,
  onOk,
  loading = false,
}: SelectFilesDialogProps) {
  const { t } = useTranslation();
  const [currentFolderId, setCurrentFolderId] = useState<string>('');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [searchString, setSearchString] = useState<string>('');
  const [folderPath, setFolderPath] = useState<FolderPath[]>([
    { id: '', name: t('fileManager.files') },
  ]);
  const [files, setFiles] = useState<FileItem[]>([]);

  const { loading: fetchLoading, fetchList } = useFetchPureFileList();

  // Fetch files when folder changes
  useMemo(() => {
    if (visible) {
      fetchList(currentFolderId).then((data) => {
        setFiles(data?.data || []);
      });
    }
  }, [currentFolderId, visible, fetchList]);

  const filteredFiles = useMemo(() => {
    if (!searchString) return files;
    return files.filter((file) =>
      file.name.toLowerCase().includes(searchString.toLowerCase()),
    );
  }, [files, searchString]);

  const handleFolderClick = (folder: FileItem) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    setSearchString('');
  };

  const handleBreadcrumbClick = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolderId(newPath[newPath.length - 1].id);
    setSearchString('');
  };

  const handleFileSelect = (fileId: string, isFolder: boolean) => {
    if (isFolder) {
      return;
    }

    setSelectedFileIds((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId],
    );
  };

  const handleOk = () => {
    onOk(selectedFileIds);
    handleClose();
  };

  const handleClose = () => {
    setCurrentFolderId('');
    setSelectedFileIds([]);
    setSearchString('');
    setFolderPath([{ id: '', name: t('fileManager.files') }]);
    setFiles([]);
    onCancel();
  };

  return (
    <Dialog open={visible} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('fileManager.selectFilesToAdd')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Breadcrumb>
            <BreadcrumbList>
              {folderPath.map((item, index) => (
                <>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem key={item.id}>
                    <BreadcrumbLink
                      onClick={() => handleBreadcrumbClick(index)}
                      className="cursor-pointer"
                    >
                      {item.name}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('common.search')}
              value={searchString}
              onChange={(e) => setSearchString(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {selectedFileIds.length > 0
              ? t('fileManager.filesSelectedCount', {
                  count: selectedFileIds.length,
                })
              : t('fileManager.noFilesSelected')}
          </div>

          <ScrollArea className="h-[400px] border rounded-md">
            <div className="p-2">
              {fetchLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading...
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('common.noResults')}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredFiles.map((file) => {
                    const isFolder = file.type === 'folder';
                    const isSelected = selectedFileIds.includes(file.id);

                    return (
                      <div
                        key={file.id}
                        className={`flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer ${
                          isSelected && !isFolder ? 'bg-accent' : ''
                        }`}
                        onClick={() =>
                          isFolder
                            ? handleFolderClick(file)
                            : handleFileSelect(file.id, isFolder)
                        }
                      >
                        {!isFolder && (
                          <Checkbox
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() =>
                              handleFileSelect(file.id, isFolder)
                            }
                          />
                        )}
                        {isFolder ? (
                          <Folder className="h-4 w-4 text-blue-500" />
                        ) : (
                          <File className="h-4 w-4 text-gray-500" />
                        )}
                        <span className="flex-1 truncate">{file.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleOk}
            disabled={selectedFileIds.length === 0 || loading}
          >
            {loading ? 'Loading...' : t('common.ok')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
