import type React from 'react';
import { createContext, useContext, useState } from 'react';

const AdminSidebarContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
} | null>(null);

export function AdminSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <AdminSidebarContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </AdminSidebarContext.Provider>
  );
}

export function useAdminSidebar() {
  const context = useContext(AdminSidebarContext);
  if (!context) {
    throw new Error(
      'useAdminSidebar must be used within an AdminSidebarProvider',
    );
  }
  return context;
}
