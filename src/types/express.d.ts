declare namespace Express{
    interface Request{
        user?: { userId: number; role: "USER" | "ADMIN" };
        context?: {
            requestId: string;
            ip: string | undefined;
            userAgent: string | undefined;
        };
    }
}
