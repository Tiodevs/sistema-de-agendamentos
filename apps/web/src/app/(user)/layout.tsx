import { UserShell } from '@/components/user/user-shell';

export default function UserLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <UserShell>{children}</UserShell>;
}
