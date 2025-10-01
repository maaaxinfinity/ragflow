import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect, useCallback } from 'react';
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
  // Cache folder file IDs to avoid repeated API calls
  const [folderFilesCache, setFolderFilesCache] = useState<
    Map<string, string[]>
  >(new Map());
  // Track which folders have all their files selected
  const [fullySelectedFolders, setFullySelectedFolders] = useState<Set<string>>(
    new Set(),
  );

  const { loading: fetchLoading, fetchList } = useFetchPureFileList();

  // Fetch files when folder changes
  useEffect(() => {
    if (visible) {
      fetchList(currentFolderId).then((result) => {
        if (result?.code === 0 && result?.data?.files) {
          // Filter out .knowledgebase folder
          const fileList = result.data.files.filter(
            (file: FileItem) => file.name !== '.knowledgebase'
          );
          setFiles(fileList);
        } else {
          setFiles([]);
        }
      });
    }
  }, [currentFolderId, visible, fetchList]);

  // Recursively get all file IDs from a folder (with caching)
  const getFileIdsRecursively = useCallback(
    async (folderId: string): Promise<string[]> => {
      // Check cache first using functional update to access latest cache
      let cachedResult: string[] | undefined;
      setFolderFilesCache((prev) => {
        cachedResult = prev.get(folderId);
        return prev;
      });
      if (cachedResult) {
        return cachedResult;
      }

      const result = await fetchList(folderId);
      if (result?.code !== 0 || !result?.data?.files) {
        return [];
      }

      const files: FileItem[] = result.data.files;
      let allFileIds: string[] = [];

      for (const file of files) {
        // Skip .knowledgebase folder
        if (file.name === '.knowledgebase') {
          continue;
        }

        if (file.type === 'folder') {
          // Recursively get files from subfolder
          const subFileIds = await getFileIdsRecursively(file.id);
          allFileIds = allFileIds.concat(subFileIds);
        } else {
          // Add file ID
          allFileIds.push(file.id);
        }
      }

      // Cache the result
      setFolderFilesCache((prev) => new Map(prev).set(folderId, allFileIds));

      return allFileIds;
    },
    [fetchList],
  );

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

  const handleFileSelect = async (fileId: string, file: FileItem) => {
    const isFolder = file.type === 'folder';

    if (isFolder) {
      // Get all files from folder recursively
      const folderFileIds = await getFileIdsRecursively(fileId);

      // Check if folder is currently fully selected
      const isFolderFullySelected = fullySelectedFolders.has(fileId);

      if (isFolderFullySelected) {
        // Remove folder mark and all its files
        setFullySelectedFolders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(fileId);
          return newSet;
        });
        setSelectedFileIds((prev) =>
          prev.filter((id) => !folderFileIds.includes(id)),
        );
      } else {
        // Add folder mark and all its files
        setFullySelectedFolders((prev) => new Set(prev).add(fileId));
        setSelectedFileIds((prev) => {
          const newIds = [...prev];
          folderFileIds.forEach((id) => {
            if (!newIds.includes(id)) {
              newIds.push(id);
            }
          });
          return newIds;
        });
      }
    } else {
      // Toggle single file selection
      const newSelectedFileIds = selectedFileIds.includes(fileId)
        ? selectedFileIds.filter((id) => id !== fileId)
        : [...selectedFileIds, fileId];

      setSelectedFileIds(newSelectedFileIds);

      // Check all folders and update their fully-selected status
      // Remove folders from fullySelectedFolders if not all their files are selected
      const updatedFullySelectedFolders = new Set(fullySelectedFolders);
      for (const folderId of fullySelectedFolders) {
        const folderFiles = folderFilesCache.get(folderId);
        if (folderFiles) {
          const allFilesSelected = folderFiles.every((id) =>
            newSelectedFileIds.includes(id),
          );
          if (!allFilesSelected) {
            updatedFullySelectedFolders.delete(folderId);
          }
        }
      }
      setFullySelectedFolders(updatedFullySelectedFolders);
    }
  };

  const handleOk = () => {
    onOk(selectedFileIds);
    handleClose();
  };

  const handleClose = () => {
    setCurrentFolderId('');
    setSelectedFileIds([]);
    setFullySelectedFolders(new Set());
    setSearchString('');
    setFolderPath([{ id: '', name: t('fileManager.files') }]);
    setFiles([]);
    setFolderFilesCache(new Map());
    onCancel();
  };

  return (
    <Dialog open={visible} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('fileManager.selectFilesToAdd')}</DialogTitle>
          <DialogDescription>
            {t('fileManager.selectFiles')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Breadcrumb>
            <BreadcrumbList>
              {folderPath.map((item, index) => (
                <BreadcrumbItem key={item.id || index}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbLink
                    onClick={() => handleBreadcrumbClick(index)}
                    className="cursor-pointer"
                  >
                    {item.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>
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
                    const isSelected = isFolder
                      ? fullySelectedFolders.has(file.id)
                      : selectedFileIds.includes(file.id);

                    return (
                      <div
                        key={file.id}
                        className={`flex items-center gap-3 p-2 rounded-md hover:bg-accent ${
                          isSelected ? 'bg-accent' : ''
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() =>
                            handleFileSelect(file.id, file)
                          }
                        />
                        {isFolder ? (
                          <Folder className="h-4 w-4 text-blue-500" />
                        ) : (
                          <File className="h-4 w-4 text-gray-500" />
                        )}
                        <span
                          className="flex-1 truncate cursor-pointer"
                          onClick={() =>
                            isFolder && handleFolderClick(file)
                          }
                        >
                          {file.name}
                        </span>
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
