import { ProfessionalShell } from '@/components/professional/professional-shell';

export default function ProfessionalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ProfessionalShell>{children}</ProfessionalShell>;
}
