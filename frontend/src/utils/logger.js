const isDev = import.meta.env.DEV;

export const log = isDev ? console.log.bind(console) : () => {};
export const warn = isDev ? console.warn.bind(console) : () => {};
export const error = console.error.bind(console);
