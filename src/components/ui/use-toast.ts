interface ToastProps {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

type Toast = (props: ToastProps) => void;

const toast: Toast = (props) => {
  console.log("Toast:", props);
  // Placeholder for actual toast implementation
};

export { toast };
