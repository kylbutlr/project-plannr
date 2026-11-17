export function formatCliError(error) {
  const target = typeof error?.path === "string" ? ` ${error.path}` : " the selected path";

  if (["EACCES", "EPERM", "EROFS"].includes(error?.code)) {
    return `Cannot access${target}. Choose a file or folder you can access, then try again.`;
  }

  if (error?.code === "ENOENT") {
    return `Could not find${target}. Check the path and try again.`;
  }

  return error?.message || "App Stylr could not complete the command. Check the inputs and try again.";
}
