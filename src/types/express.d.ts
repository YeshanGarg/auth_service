declare namespace Express{
    interface Request{
        user? : JWTPayload;
        context?: {
            requestId: string;
            ip: string | undefined;
            userAgent: string | undefined;
        };
    }
}
