import SidebarLayout from '@/components/SidebarLayout';

export default function SidebarGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarLayout>{children}</SidebarLayout>;
}
