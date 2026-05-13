import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import LoginRequiredDialog from "@/components/auth/LoginRequiredDialog";

type RequireAuthFn = (action: () => void, opts?: { message?: string }) => void;

const RequireAuthContext = createContext<RequireAuthFn | null>(null);

export const RequireAuthProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [message, setMessage] = useState<string | undefined>();

  const requireAuth = useCallback<RequireAuthFn>((action, opts) => {
    if (user) {
      action();
      return;
    }
    setPending(() => action);
    setMessage(opts?.message);
    setOpen(true);
  }, [user]);

  return (
    <RequireAuthContext.Provider value={requireAuth}>
      {children}
      <LoginRequiredDialog
        open={open}
        onOpenChange={setOpen}
        message={message}
        afterLogin={() => {
          setOpen(false);
          if (pending) pending();
          setPending(null);
        }}
      />
    </RequireAuthContext.Provider>
  );
};

export const useRequireAuth = (): RequireAuthFn => {
  const ctx = useContext(RequireAuthContext);
  if (!ctx) throw new Error("useRequireAuth must be used within RequireAuthProvider");
  return ctx;
};
