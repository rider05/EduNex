// utils/toastService.js

let toastRef = null;

// ✅ Called once in Index.js to register the global toast instance
export const setToastRef = (ref) => {
  toastRef = ref;
};

// ✅ Reusable function for any screen to trigger toast messages
export const showToast = (message, type = "success") => {
  if (toastRef && typeof toastRef.showToast === "function") {
    toastRef.showToast(message, type);
  } else {
    console.warn("Toast system not initialized yet.");
  }
};