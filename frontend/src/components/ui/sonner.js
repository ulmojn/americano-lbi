import { Toaster as Sonner } from "sonner";

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#121212] group-[.toaster]:text-white group-[.toaster]:border-[#262626] group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-gray-400",
          actionButton:
            "group-[.toast]:bg-[#D1F441] group-[.toast]:text-[#0A0A0A]",
          cancelButton:
            "group-[.toast]:bg-[#262626] group-[.toast]:text-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
