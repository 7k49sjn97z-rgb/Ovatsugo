/** Prevent spreadsheet formula execution when exported free text is opened in Excel. */
export function spreadsheetText(value: string) {
  return /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
}
