import { useAuth } from '@/hooks/auth-hooks';
import { redirectToLogin } from '@/utils/authorization-util';
import { Outlet, useLocation } from 'umi';

const ANONYMOUS_ALLOWLIST = ['/free-chat/test'];

export default () => {
  const location = useLocation();
  const { isLogin } = useAuth();

  const normalizedPath = (() => {
    if (location.pathname === '/' && location.hash?.startsWith('#/')) {
      return location.hash.slice(1);
    }
    return location.pathname;
  })();

  if (ANONYMOUS_ALLOWLIST.includes(normalizedPath)) {
    return <Outlet />;
  }

  if (isLogin === true) {
    return <Outlet />;
  } else if (isLogin === false) {
    redirectToLogin();
  }

  return <></>;
};
