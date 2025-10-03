import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, Mail, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'umi';
import { useTranslate } from '@/hooks/common-hooks';

export default function FreeChatUnauthorized() {
  const navigate = useNavigate();
  const { t } = useTranslate('common');

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="max-w-md w-full px-6">
        <div className="text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-6">
              <ShieldAlert className="h-16 w-16 text-destructive" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              访问受限
            </h1>
            <p className="text-muted-foreground">
              您没有权限访问此Free Chat会话
            </p>
          </div>

          {/* Alert */}
          <Alert variant="destructive">
            <AlertDescription className="text-left">
              <div className="space-y-2">
                <p className="font-semibold">可能的原因：</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>您不是该团队的成员</li>
                  <li>该用户ID未被授权访问</li>
                  <li>会话已被团队管理员删除</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Contact Info */}
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">需要帮助？</span>
            </div>
            <p className="text-sm text-muted-foreground text-left">
              请联系您的团队管理员以获取访问权限。管理员可以在团队设置中为您添加权限。
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4">
            <Button
              onClick={() => navigate('/')}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回首页
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/team/settings')}
              className="w-full"
            >
              团队设置
            </Button>
          </div>

          {/* Footer */}
          <p className="text-xs text-muted-foreground pt-4">
            如果您认为这是一个错误，请联系系统管理员
          </p>
        </div>
      </div>
    </div>
  );
}
