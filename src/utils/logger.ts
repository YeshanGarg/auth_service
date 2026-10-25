const redact = (key: string, value: unknown) =>
    /password|token|authorization|cookie|secret|database_url|email/i.test(key) ? "[REDACTED]" : value;

export const logger = {
    info(message: string, meta?:object){
        console.log(
            JSON.stringify({
                level: "info",
                message,
                meta,
                timestamp: new Date().toISOString(),
            }, redact)
        );
    },

    error(message: string, meta?: object) {
        console.error(
            JSON.stringify({
                level: "error",
                message,
                meta,
                timestamp: new Date().toISOString(),
            }, redact)
        );
    },
};